// ==============================================================================
// 0. KONFIGURACJA SUPABASE I ZMIENNE GLOBALNE
// ==============================================================================
const SUPABASE_URL = "https://hxytdcsmaegoffkwdprd.supabase.co";
const SUPABASE_KEY = "sb_publishable_Iqua1-hPT4hzINjAD3ta0w_HPn-fhLv";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ALL_TEAMS = ["Pakuły", "Sileziny", "Śnieżyńscy"];

let currentUser = null;
let currentUserId = null;
let currentTeam = null;

let bazaKursow = {
  "EUR_PLN": 4.30, "PLN_EUR": 0.2325,
  "EUR_EUR": 1.0,  "PLN_PLN": 1.0
};
let malzenstwaMapa = {};
let ekipyMapa = {};

// ==============================================================================
// 0.1 INICJALIZACJA I OBSŁUGA SPLASH
// ==============================================================================
function initApp() {
  const savedUser = localStorage.getItem("zimowisko_user");
  const savedUserId = localStorage.getItem("zimowisko_user_id");
  const savedTeam = localStorage.getItem("zimowisko_team");

  // Jeśli sesja istnieje w pamięci przeglądarki – pomijamy splash i logowanie
  if (savedUser && savedUserId) {
    currentUser = savedUser;
    currentUserId = parseInt(savedUserId);
    currentTeam = savedTeam;

    pobierzKursyWalut();
    pobierzUzytkownikowIMalzenstwa();
    wejdzDoAplikacji();
    return;
  }

  // Niezalogowany: logo wisi na środku przez 1.5 sekundy, potem zsuwa się i pokazuje formularz
  startSplashSequence();

  pobierzKursyWalut();
  pobierzUzytkownikowIMalzenstwa();
}

function startSplashSequence() {
  const logoWrapper = document.getElementById("splashLogoWrapper");
  const loginCard = document.getElementById("loginFormCard");

  if (!logoWrapper || !loginCard) return;

  setTimeout(() => {
    logoWrapper.classList.remove("splash-centered");
    logoWrapper.classList.add("splash-bottom");
    loginCard.style.display = "block";
  }, 1500);
}

// ==============================================================================
// 0.2 LOGOWANIE I ZMIANA HASŁA (KOD DOSTĘPU: yeti)
// ==============================================================================
async function handleLogin() {
  const loginInput = document.getElementById("loginUsername").value.trim();
  const passInput = document.getElementById("loginPassword").value.trim();
  const feedback = document.getElementById("loginFeedback");

  if (feedback) feedback.style.display = "none";

  if (!loginInput || !passInput) {
    pokazBladLogowania("Wpisz login oraz hasło.");
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("users")
      .select("id, login, passcode, team")
      .ilike("login", loginInput)
      .maybeSingle();

    if (error || !data) {
      pokazBladLogowania("Nie znaleziono takiego użytkownika.");
      return;
    }

    if (data.passcode !== passInput) {
      pokazBladLogowania("Nieprawidłowe hasło.");
      return;
    }

    // Pomyślna autoryzacja
    currentUser = data.login;
    currentUserId = data.id;
    currentTeam = data.team;

    localStorage.setItem("zimowisko_user", currentUser);
    localStorage.setItem("zimowisko_user_id", currentUserId);
    localStorage.setItem("zimowisko_team", currentTeam);

    wejdzDoAplikacji();

  } catch (err) {
    console.error("Błąd połączenia podczas logowania:", err);
    pokazBladLogowania("Błąd połączenia z bazą danych.");
  }
}

function pokazBladLogowania(msg) {
  const feedback = document.getElementById("loginFeedback");
  if (feedback) {
    feedback.innerText = msg;
    feedback.style.display = "block";
  }
}

function showResetPasswordView() {
  document.getElementById("loginFormCard").style.display = "none";
  document.getElementById("resetPasswordCard").style.display = "block";
  document.getElementById("resetFeedback").style.display = "none";
}

function showLoginView() {
  document.getElementById("resetPasswordCard").style.display = "none";
  document.getElementById("loginFormCard").style.display = "block";
  document.getElementById("loginFeedback").style.display = "none";
}

async function handleSetNewPassword() {
  const loginInput = document.getElementById("resetUsername").value.trim();
  const newPass = document.getElementById("resetNewPassword").value.trim();
  const accessCode = document.getElementById("resetAccessCode").value.trim();
  const feedback = document.getElementById("resetFeedback");

  if (feedback) {
    feedback.style.display = "none";
    feedback.className = "alert alert-danger small mt-3 py-2 text-center";
  }

  if (!loginInput || !newPass || !accessCode) {
    if (feedback) {
      feedback.innerText = "Uzupełnij wszystkie pola.";
      feedback.style.display = "block";
    }
    return;
  }

  if (accessCode.toLowerCase() !== "yeti") {
    if (feedback) {
      feedback.innerText = "Niepoprawny kod dostępu!";
      feedback.style.display = "block";
    }
    return;
  }

  try {
    const { data: user, error: findError } = await supabaseClient
      .from("users")
      .select("id, login")
      .ilike("login", loginInput)
      .maybeSingle();

    if (findError || !user) {
      if (feedback) {
        feedback.innerText = "Nie znaleziono użytkownika: " + loginInput;
        feedback.style.display = "block";
      }
      return;
    }

    const { error: updateError } = await supabaseClient
      .from("users")
      .update({ passcode: newPass })
      .eq("id", user.id);

    if (updateError) {
      if (feedback) {
        feedback.innerText = "Błąd zapisu nowego hasła: " + updateError.message;
        feedback.style.display = "block";
      }
      return;
    }

    alert("Hasło zostało pomyślnie zmienione! Zaloguj się nowym hasłem.");
    showLoginView();
    document.getElementById("loginUsername").value = user.login;
    document.getElementById("loginPassword").value = "";

  } catch (err) {
    console.error("Błąd zapisu hasła:", err);
    if (feedback) {
      feedback.innerText = "Błąd połączenia z bazą danych.";
      feedback.style.display = "block";
    }
  }
}

function handleLogout() {
  localStorage.removeItem("zimowisko_user");
  localStorage.removeItem("zimowisko_user_id");
  localStorage.removeItem("zimowisko_team");
  localStorage.removeItem("zimowisko_tab");
  currentUser = null;
  currentUserId = null;
  currentTeam = null;

  location.reload();
}

function wejdzDoAplikacji() {
  const authScreen = document.getElementById("authScreen");
  const appSection = document.getElementById("appSection");
  if (authScreen) authScreen.style.display = "none";
  if (appSection) appSection.style.display = "block";

  // W prawym górnym rogu nagłówka: sama ikona wylogowania
  const navRight = document.getElementById("navRightSection");
  if (navRight) {
    navRight.innerHTML = `
      <button class="btn btn-outline-danger btn-sm py-1 px-2 border-0" onclick="handleLogout()" title="Wyloguj się">
        <i class="bi bi-box-arrow-right fs-5"></i>
      </button>
    `;
  }

  // Słowackie powitanie
  const welcomeEl = document.getElementById("welcomeUserName");
  if (welcomeEl) welcomeEl.innerText = currentUser;

  // Ustawienie awatara
  ustawAvatarUzytkownika(currentUser);

  renderDashboardDate();
  const savedTab = localStorage.getItem("zimowisko_tab") || "dashboard";
  switchTab(savedTab);
}

function ustawAvatarUzytkownika(userName) {
  const avatarImg = document.getElementById("dashboardUserAvatar");
  if (!avatarImg || !userName) return;

  const basePath = `assets/avatars/${userName}`;
  const extensions = ['.png', '.jpg', '.jpeg'];
  let extIndex = 0;

  avatarImg.onerror = function() {
    extIndex++;
    if (extIndex < extensions.length) {
      avatarImg.src = `${basePath}${extensions[extIndex]}`;
    } else {
      avatarImg.onerror = null;
      avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0F172A&color=fff`;
    }
  };

  avatarImg.src = `${basePath}${extensions[0]}`;
}

// ==============================================================================
// 0.3 DANE BAZOWE, ZEGAR I ROUTING
// ==============================================================================
async function pobierzKursyWalut() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=PLN");
    const dane = await res.json();
    if (dane && dane.rates && dane.rates.PLN) {
      const eurPln = dane.rates.PLN;
      bazaKursow["EUR_PLN"] = eurPln;
      bazaKursow["PLN_EUR"] = 1 / eurPln;
    }
  } catch (e) {
    console.warn("Domyślny kurs EUR/PLN:", e);
  }
}

async function pobierzUzytkownikowIMalzenstwa() {
  try {
    const { data, error } = await supabaseClient.from("users").select("id, login, team, spouse_id");
    if (error || !data) return;

    const idToLogin = {};
    data.forEach(u => {
      idToLogin[u.id] = u.login;
      ekipyMapa[u.login] = u.team || "Pakuły";
    });
    data.forEach(u => {
      if (u.spouse_id && idToLogin[u.spouse_id]) {
        malzenstwaMapa[u.login] = idToLogin[u.spouse_id];
      }
    });
  } catch (err) {
    console.error("Błąd pobierania bazy użytkowników:", err);
  }
}

function renderDashboardDate() {
  const container = document.getElementById("dashboardDateBox");
  if (!container) return;

  const now = new Date();
  const day = now.getDate();
  const months = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  const weekdays = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];

  const targetDate = new Date(2027, 1, 6);
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.ceil((targetDate - todayOnly) / (1000 * 60 * 60 * 24));

  container.innerHTML = `
    <div class="fw-bold text-dark">${day} ${months[now.getMonth()]}</div>
    <div class="text-muted small">${weekdays[now.getDay()]}</div>
    <div class="fw-bold text-primary mt-1" style="font-size: 0.78rem;">⏳ ${diffDays} dni do szusowania</div>
  `;
}

function switchTab(tabId) {
  if (!tabId) tabId = "dashboard";
  const tabs = document.querySelectorAll(".app-tab");
  tabs.forEach(t => t.style.display = "none");

  const dash = document.getElementById("tab-dashboard");

  if (tabId === "dashboard" || tabId === "tab-dashboard") {
    if (dash) {
      dash.style.display = "block";
      renderDashboardDate();
    }
    localStorage.setItem("zimowisko_tab", "dashboard");
    return;
  }

  let targetEl = document.getElementById(tabId) || document.getElementById("tab-" + tabId.replace("tab-", ""));
  if (targetEl) {
    targetEl.style.display = "block";
    localStorage.setItem("zimowisko_tab", targetEl.id);

    if (targetEl.id === "tab-costs") loadCosts();
  }
}

// ==============================================================================
// 3. MODUŁ: WYDATKI
// ==============================================================================
window.toggleNewCostForm = function() {
  const box = document.getElementById("newCostFormCollapse");
  const icon = document.getElementById("iconNewCostToggle");
  if (!box) return;
  const isHidden = (box.style.display === "none" || box.style.display === "");
  box.style.display = isHidden ? "block" : "none";
  if (icon) icon.className = isHidden ? "bi bi-chevron-up text-muted fs-5" : "bi bi-chevron-down text-muted fs-5";
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

function setupBorrowerCheckboxes() {
  const usersBox = document.getElementById("borrowerUsersCheckboxes");
  if (usersBox && usersBox.children.length === 0) {
    const defaultUsers = ["Asia", "Maciek", "Kacper", "Natalia", "Gosia", "Artur", "Pola", "Tosia", "Kasia", "Janek", "Henio"];
    const usersList = Object.keys(ekipyMapa).length > 0 ? Object.keys(ekipyMapa) : defaultUsers;
    usersBox.innerHTML = usersList.map(u => 
      `<label class="badge bg-white text-dark border p-1 small me-1 mb-1"><input type="checkbox" class="user-cb" value="${u}"> ${u}</label>`
    ).join("");
  }

  const rTeams = document.getElementById("bModeTeams");
  const rUsers = document.getElementById("bModeUsers");
  const boxTeams = document.getElementById("boxBorrowerTeams");
  const boxUsers = document.getElementById("boxBorrowerUsers");

  const update = () => {
    if (boxTeams) boxTeams.style.display = (rTeams && rTeams.checked) ? "block" : "none";
    if (boxUsers) boxUsers.style.display = (rUsers && rUsers.checked) ? "block" : "none";
  };

  ["bModeAll", "bModeTeams", "bModeUsers"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onchange = update;
  });
}

async function loadCosts() {
  const container = document.getElementById("costsList");
  if (!container) return;

  container.innerHTML = "<div class='text-muted small py-2 text-center'>Ładowanie wydatków...</div>";
  setupBorrowerCheckboxes();

  const { data, error } = await supabaseClient
    .from("costs")
    .select("*")
    .eq("deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = `<div class='alert alert-danger small'>Błąd: ${error.message}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "<div class='text-muted small text-center p-3'>Brak wydatków w bazie.</div>";
    return;
  }

  container.innerHTML = data.filter(c => !c.is_archived).map(c => {
    const rate = bazaKursow["EUR_PLN"] || 4.30;
    const inPln = (c.currency === "EUR") ? `(~${(c.amount * rate).toFixed(2)} PLN)` : "";
    return `
      <div class="${c.is_private ? 'stado-card-private' : 'stado-card'}">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="fw-bold">${c.is_private ? '🔒 [Prywatny] ' : ''}${escapeHtml(c.cost_name)}</div>
            <div class="small text-muted mt-1">Płacił(a): <b>${escapeHtml(c.paid_by)}</b> ➔ Dla: <b>${escapeHtml(c.borrower || 'Wszyscy')}</b></div>
            ${c.comment ? `<div class="small fst-italic text-secondary mt-1">${escapeHtml(c.comment)}</div>` : ''}
          </div>
          <div class="text-end">
            <div class="fw-bold fs-6" style="color:var(--navy);">${parseFloat(c.amount).toFixed(2)} ${c.currency}</div>
            <div class="text-muted" style="font-size:0.75rem;">${inPln}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

const formCost = document.getElementById("formCost");
if (formCost) {
  formCost.onsubmit = async (e) => {
    e.preventDefault();

    const name = document.getElementById("costName").value.trim();
    const amount = parseFloat(document.getElementById("costAmount").value);
    const currency = document.getElementById("costCurrency").value;
    const comment = document.getElementById("costComment").value.trim();
    const isPrivate = document.getElementById("costIsPrivate").checked;

    let borrower = "Wszyscy";
    if (!isPrivate) {
      const mode = document.querySelector("input[name='borrowerMode']:checked")?.value;
      if (mode === "teams") {
        const checked = Array.from(document.querySelectorAll(".team-cb:checked")).map(cb => cb.value);
        borrower = checked.length > 0 ? checked.join(", ") : "Wszyscy";
      } else if (mode === "users") {
        const checked = Array.from(document.querySelectorAll(".user-cb:checked")).map(cb => cb.value);
        borrower = checked.length > 0 ? checked.join(", ") : "Wszyscy";
      }
    } else {
      borrower = "Tylko dla mnie";
    }

    const payload = {
      created_by: currentUserId,
      paid_by: currentUser,
      amount: amount,
      currency: currency,
      cost_name: name,
      borrower: borrower,
      comment: comment || null,
      is_private: isPrivate,
      settled_by: [],
      deleted: false,
      is_archived: false
    };

    const { error } = await supabaseClient.from("costs").insert([payload]);

    if (error) {
      alert("Błąd zapisu wydatku:\n" + error.message);
      return;
    }

    formCost.reset();
    toggleNewCostForm();
    await loadCosts();
  };
}

// Inicjalizacja
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}