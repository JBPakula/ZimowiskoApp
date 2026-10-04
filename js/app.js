// js/app.js



// ==============================================================================
// 0. KONFIGURACJA SUPABASE I ZMIENNE GLOBALNE
// ==============================================================================
const SUPABASE_URL = "https://hxytdcsmaegoffkwdprd.supabase.co";
const SUPABASE_KEY = "sb_publishable_Iqua1-hPT4hzINjAD3ta0w_HPn-fhLv";

// Bezpośrednia inicjalizacja klienta Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ALL_TEAMS = ["Pakuły", "Sileziny", "Śnieżyńscy"];

// Bieżący użytkownik (ekran logowania wyłączony)
let currentUser = "Asia";
let currentUserId = 1;
let currentTeam = "Pakuły";

let bazaKursow = {
  "EUR_PLN": 4.30, "PLN_EUR": 0.2325,
  "EUR_EUR": 1.0,  "PLN_PLN": 1.0
};
let malzenstwaMapa = {};
let ekipyMapa = {};

// ==============================================================================
// 0.1 INICJALIZACJA APLIKACJI
// ==============================================================================
async function initApp() {
  await pobierzKursyWalut();
  if (supabaseClient) {
    await pobierzUzytkownikowIMalzenstwa();
  } else {
    // Dane zastępcze offline
    ekipyMapa = {
      "Asia": "Pakuły", "Maciek": "Pakuły", "Kacper": "Pakuły", "Natalia": "Pakuły",
      "Gosia": "Sileziny", "Artur": "Sileziny", "Pola": "Sileziny", "Tosia": "Sileziny",
      "Kasia": "Śnieżyńscy", "Janek": "Śnieżyńscy", "Henio": "Śnieżyńscy"
    };
    malzenstwaMapa = {
      "Asia": "Maciek", "Maciek": "Asia",
      "Gosia": "Artur", "Artur": "Gosia",
      "Kasia": "Janek", "Janek": "Kasia"
    };
  }

  // Wymuszenie bezpośredniego wejścia do aplikacji (login zakomentowany)
  document.getElementById("appSection").style.display = "block";
  renderDashboardDate();
  setupEventListeners();

  const savedTab = localStorage.getItem("zimowisko_tab") || "dashboard";
  switchTab(savedTab);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

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
    console.warn("Używam kursu domyślnego EUR/PLN:", e);
  }
}

async function pobierzUzytkownikowIMalzenstwa() {
  try {
    const { data, error } = await supabaseClient.from("users").select("id, login, team, spouse_id");
    if (error) {
      console.error("Błąd pobierania użytkowników z Supabase:", error);
      return;
    }
    if (data && data.length > 0) {
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

      // Dopasowujemy bieżące ID użytkownika bezpośrednio z tabeli users w bazie
      const me = data.find(u => u.login.toLowerCase() === currentUser.toLowerCase());
      if (me) {
        currentUserId = me.id;
        currentTeam = me.team;
      }
      console.log(`Zalogowano jako: ${currentUser} | ID w bazie: ${currentUserId} | Ekipa: ${currentTeam}`);
    }
  } catch (err) {
    console.error("Krytyczny błąd pobierania użytkowników:", err);
  }
}
// ==============================================================================
// 0.2 NAWIGACJA (SWITCHTAB) I ODROCZONE ODLICZANIE
// ==============================================================================
function renderDashboardDate() {
  const container = document.getElementById("dashboardDateBox");
  if (!container) return;

  const now = new Date();
  const day = now.getDate();
  const months = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  const weekdays = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];

  // Wyjazd: 06.02.2027
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
    if (dash) dash.style.display = "block";
    localStorage.setItem("zimowisko_tab", "dashboard");
    return;
  }

  let targetEl = document.getElementById(tabId) || document.getElementById("tab-" + tabId.replace("tab-", ""));
  if (targetEl) {
    targetEl.style.display = "block";
    localStorage.setItem("zimowisko_tab", targetEl.id);

    if (targetEl.id === "tab-plan") loadDailyLogs();
    if (targetEl.id === "tab-costs") loadCosts();
    if (targetEl.id === "tab-wallet") loadWallet();
    if (targetEl.id === "tab-shopping") loadShoppingLists();
    if (targetEl.id === "tab-forum") loadForum();
    if (targetEl.id === "tab-diary") loadDiary();
    if (targetEl.id === "tab-games") loadGames();
    if (targetEl.id === "tab-exchange") przeliczKantor();
  }
}

// ==============================================================================
// 1. MODUŁ: PLAN DNIA & ZAPISKI ZE STOKU
// ==============================================================================
async function loadDailyLogs() {
  const container = document.getElementById("dailyLogsList");
  if (!container) return;
  container.innerHTML = "<div class='text-muted small py-2'>Ładowanie zapisków...</div>";

  if (!supabaseClient) {
    container.innerHTML = "<div class='text-muted small py-2'>Podłącz Supabase w js/app.js, aby zapisywać dni stoku.</div>";
    return;
  }

  const { data } = await supabaseClient.from("daily_logs").select("*").order("trip_date", { ascending: false });
  if (!data || data.length === 0) {
    container.innerHTML = "<div class='text-muted small p-2 bg-light rounded text-center'>Brak wpisów. Zapisz pierwszy dzień powyżej! 🎿</div>";
    return;
  }

  container.innerHTML = data.map(log => `
    <div class="card p-3 border-0 shadow-sm rounded-3 mb-2 bg-white">
      <div class="d-flex justify-content-between align-items-center mb-1">
        <span class="badge bg-primary">${log.trip_date}</span>
        <b style="color: var(--navy);">${log.resort_name}</b>
      </div>
      ${log.weather_note ? `<div class="small text-muted mb-1">⛅ ${log.weather_note}</div>` : ''}
      ${log.notes ? `<div class="small mt-1 p-2 bg-light rounded">${log.notes}</div>` : ''}
    </div>
  `).join("");
}

const formDailyLog = document.getElementById("formDailyLog");
if (formDailyLog) {
  formDailyLog.onsubmit = async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      alert("Brak połączenia z bazą! Upewnij się, że SUPABASE_URL i SUPABASE_KEY są uzupełnione w js/app.js.");
      return;
    }

    const dDate = document.getElementById("dailyLogDate").value;
    const dResort = document.getElementById("dailyLogResort").value;
    const dWeather = document.getElementById("dailyLogWeather").value.trim();
    const dNotes = document.getElementById("dailyLogNotes").value.trim();

    const { data, error } = await supabaseClient.from("daily_logs").insert([{
      trip_date: dDate,
      resort_name: dResort,
      weather_note: dWeather || null,
      notes: dNotes || null,
      created_by: currentUserId
    }]).select();

    if (error) {
      console.error("Błąd zapisu do daily_logs:", error);
      alert("Błąd zapisu: " + (error.message || JSON.stringify(error)));
      return;
    }

    formDailyLog.reset();
    loadDailyLogs();
  };
}

// ==============================================================================
// 3. MODUŁ: WYDATKI (PRZEPISANY 1:1 ZE SPRAWDZONEGO WZORCA)
// ==============================================================================

// Rozwijanie / zwijanie formularza nowego wydatku
window.toggleNewCostForm = function() {
  const box = document.getElementById("newCostFormCollapse");
  const icon = document.getElementById("iconNewCostToggle");
  if (!box) return;
  
  if (box.style.display === "none" || box.style.display === "") {
    box.style.display = "block";
    if (icon) icon.className = "bi bi-chevron-up text-muted fs-5";
  } else {
    box.style.display = "none";
    if (icon) icon.className = "bi bi-chevron-down text-muted fs-5";
  }
};

// Rozwijanie / zwijanie archiwum
window.toggleArchivedCosts = function() {
  const box = document.getElementById("archivedCostsList");
  const icon = document.getElementById("iconArchivedCostsToggle");
  if (!box) return;
  
  const isHidden = (box.style.display === "none" || box.style.display === "");
  box.style.display = isHidden ? "block" : "none";
  if (icon) icon.className = isHidden ? "bi bi-chevron-up text-muted" : "bi bi-chevron-down text-muted";
};

// Pomocnicza funkcja czyszcząca tekst z HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

// Konfiguracja checkboxów wyboru ekip i osób
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

// Pobieranie i renderowanie listy wydatków z bazy Supabase
async function loadCosts() {
  const container = document.getElementById("costsList");
  const archivedContainer = document.getElementById("archivedCostsList");
  if (!container) return;

  container.innerHTML = "<div class='text-muted small py-2 text-center'>Ładowanie wydatków...</div>";
  setupBorrowerCheckboxes();

  if (!supabaseClient) {
    container.innerHTML = "<div class='alert alert-warning small'>Brak poprawnego połączenia z Supabase. Sprawdź klucze API.</div>";
    return;
  }

  const { data, error } = await supabaseClient
    .from("costs")
    .select("*")
    .eq("deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Błąd pobierania z tabeli costs:", error);
    container.innerHTML = `<div class='alert alert-danger small'>Błąd ładowania danych: ${error.message}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "<div class='text-muted small text-center p-3'>Brak wydatków w bazie. Rozwiń formularz powyżej i dodaj pierwszy! 💶</div>";
    if (archivedContainer) archivedContainer.innerHTML = "<div class='text-muted small text-center p-2'>Brak archiwum.</div>";
    return;
  }

  const activeCosts = data.filter(c => !c.is_archived);
  const archivedCosts = data.filter(c => c.is_archived);

  // Renderowanie aktywnych wydatków
  if (activeCosts.length === 0) {
    container.innerHTML = "<div class='text-muted small text-center p-3'>Wszystkie wydatki są zarchiwizowane.</div>";
  } else {
    container.innerHTML = activeCosts.map(c => {
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

  // Renderowanie zarchiwizowanych
  if (archivedContainer) {
    archivedContainer.innerHTML = archivedCosts.length === 0 
      ? "<div class='text-muted small text-center p-2'>Brak zarchiwizowanych wydatków.</div>"
      : archivedCosts.map(c => `
          <div class="p-2 border-bottom small text-muted d-flex justify-content-between">
            <span>${escapeHtml(c.cost_name)} (${escapeHtml(c.paid_by)})</span>
            <b>${parseFloat(c.amount).toFixed(2)} ${c.currency}</b>
          </div>
        `).join("");
  }
}

// Obsługa zapisu wydatku
const formCost = document.getElementById("formCost");
if (formCost) {
  formCost.onsubmit = async (e) => {
    e.preventDefault();

    if (!supabaseClient) {
      alert("Błąd: Niepoprawny klucz lub brak połączenia z bazą Supabase.");
      return;
    }

    const name = document.getElementById("costName").value.trim();
    const amountVal = document.getElementById("costAmount").value;
    const amount = parseFloat(amountVal);
    const currency = document.getElementById("costCurrency").value;
    const comment = document.getElementById("costComment").value.trim();
    const isPrivate = document.getElementById("costIsPrivate").checked;

    if (!name || isNaN(amount) || amount <= 0) {
      alert("Podaj poprawną nazwę i kwotę wydatku.");
      return;
    }

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
      created_by: currentUserId || null,
      paid_by: currentUser || "Asia",
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

    const { data, error } = await supabaseClient
      .from("costs")
      .insert([payload])
      .select();

    if (error) {
      console.error("Błąd zapisu do Supabase:", error);
      alert("Błąd zapisu wydatku:\n" + error.message);
      return;
    }

    // Reset formularza i odświeżenie widoku
    formCost.reset();
    toggleNewCostForm();
    await loadCosts();
    if (typeof loadWallet === "function") loadWallet();
  };
}

// ==============================================================================
// 4. MODUŁ: PORTFEL (KOMPENSATA PER EKIPA DLA 3 RODZIN)
// ==============================================================================
async function loadWallet() {
  const summaryEl = document.getElementById("walletTotalSummary");
  const teamBalancesEl = document.getElementById("walletTeamBalances");
  if (!summaryEl || !teamBalancesEl || !supabaseClient) return;

  const { data: costs } = await supabaseClient.from("costs").select("*").eq("deleted", false).eq("is_private", false);
  if (!costs) return;

  let totalNetEur = 0;
  const balances = { "Sileziny": 0, "Śnieżyńscy": 0, "Pakuły": 0 };

  costs.forEach(c => {
    const amt = parseFloat(c.amount) || 0;
    const amtEur = (c.currency === "PLN") ? amt * bazaKursow.PLN_EUR : amt;
    const payerTeam = ekipyMapa[c.paid_by] || "Pakuły";

    if (c.borrower === "Wszyscy") {
      const part = amtEur / 3.0;
      if (payerTeam === currentTeam) {
        ALL_TEAMS.forEach(t => { if (t !== currentTeam) balances[t] += part; });
        totalNetEur += (part * 2);
      } else {
        balances[payerTeam] -= part;
        totalNetEur -= part;
      }
    }
  });

  summaryEl.innerText = `${totalNetEur >= 0 ? '+' : ''}${totalNetEur.toFixed(2)} EUR (~${(totalNetEur * bazaKursow.EUR_PLN).toFixed(2)} PLN)`;
  summaryEl.style.color = totalNetEur >= 0 ? "green" : "red";

  teamBalancesEl.innerHTML = ALL_TEAMS.filter(t => t !== currentTeam).map(team => {
    const bal = balances[team];
    const isPlus = bal >= 0;
    return `
      <div class="p-2 mb-2 rounded border bg-white d-flex justify-content-between align-items-center">
        <b>${team}</b>
        <span class="fw-bold ${isPlus ? 'text-success' : 'text-danger'}">
          ${isPlus ? '+' : ''}${bal.toFixed(2)} EUR
        </span>
      </div>
    `;
  }).join("");
}

// ==============================================================================
// 5. MODUŁ: KANTOR EUR / PLN
// ==============================================================================
function przeliczKantor() {
  const amt = parseFloat(document.getElementById("exAmount")?.value) || 0;
  const from = document.getElementById("exFrom")?.value || "EUR";
  const to = document.getElementById("exTo")?.value || "PLN";
  const resEl = document.getElementById("exResult");

  const rate = (from === to) ? 1.0 : bazaKursow[`${from}_${to}`] || 4.30;
  const converted = (amt * rate).toFixed(2);

  if (resEl) {
    resEl.innerHTML = `
      <div class="small text-muted mb-1">Kurs: 1 ${from} = ${rate.toFixed(4)} ${to}</div>
      <div class="fs-4 fw-bold" style="color:var(--navy);">${converted} ${to}</div>
    `;
  }
}

// ==============================================================================
// 6. MODUŁ: FORUM, ZAKUPY, KRONIKA & ROZGRYWKI (STUBY PODSTAWOWE)
// ==============================================================================
async function loadShoppingLists() {}
async function loadForum() {}
async function loadDiary() {}
async function loadGames() {}

function setupEventListeners() {
  ["exAmount", "exFrom", "exTo"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", przeliczKantor);
  });

  const btnSwap = document.getElementById("btnSwapCurrencies");
  if (btnSwap) {
    btnSwap.onclick = () => {
      const f = document.getElementById("exFrom");
      const t = document.getElementById("exTo");
      const tmp = f.value;
      f.value = t.value;
      t.value = tmp;
      przeliczKantor();
    };
  }
}