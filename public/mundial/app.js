/* ====================================================
   MUNDIAL 2026 — Fuente de datos: worldcup26.ir
==================================================== */

const API_BASE = "https://worldcup26.ir/get";
const REFRESH_MS = 300000;

/* ---------- Mapeo de nombres de país a códigos ISO para flagcdn ---------- */
const COUNTRY_CODE = {
  "Algeria":"dz","Argentina":"ar","Australia":"au","Austria":"at","Belgium":"be",
  "Bosnia and Herzegovina":"ba","Brazil":"br","Canada":"ca","Cape Verde":"cv",
  "Colombia":"co","Croatia":"hr","Curaçao":"cw","Czech Republic":"cz",
  "Democratic Republic of the Congo":"cd","Ecuador":"ec","Egypt":"eg",
  "England":"gb-eng","France":"fr","Germany":"de","Ghana":"gh","Haiti":"ht",
  "Iran":"ir","Iraq":"iq","Ivory Coast":"ci","Japan":"jp","Jordan":"jo",
  "Mexico":"mx","Morocco":"ma","Netherlands":"nl","New Zealand":"nz",
  "Norway":"no","Panama":"pa","Paraguay":"py","Portugal":"pt","Qatar":"qa",
  "Saudi Arabia":"sa","Scotland":"gb-sct","Senegal":"sn","South Africa":"za",
  "South Korea":"kr","Spain":"es","Sweden":"se","Switzerland":"ch",
  "Tunisia":"tn","Turkey":"tr","United States":"us","Uruguay":"uy",
  "Uzbekistan":"uz","Italy":"it","Wales":"gb-wls","Northern Ireland":"gb-nir"
};

function flag(name) {
  if (!name) return "";
  const code = COUNTRY_CODE[name];
  if (!code) return "";
  return `https://flagcdn.com/w80/${code}.png`;
}

/* ---------- Parser de fechas "MM/DD/YYYY HH:MM" como local ---------- */
function parseLocalDate(str) {
  if (!str) return null;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return new Date(str);
  const [, mo, d, y, h, mi] = m;
  return new Date(+y, +mo - 1, +d, +h, +mi);
}

/* ---------- Mapear estado ---------- */
function mapStatus(g) {
  const te = (g.time_elapsed || "").toLowerCase();
  const fin = (g.finished || "").toUpperCase() === "TRUE";
  if (fin || te === "finished") return { short: "FT", elapsed: null };
  if (te === "live") return { short: "LIVE", elapsed: null };
  return { short: "NS", elapsed: null };
}

/* ====================================================
   API
==================================================== */
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

let _stadiums = null;
async function getStadiums() {
  if (_stadiums) return _stadiums;
  try {
    const d = await fetchJSON(`${API_BASE}/stadiums`);
    const map = {};
    (d.stadiums || []).forEach(s => {
      map[String(s.id)] = { name: s.fifa_name || s.name_en || "", city: s.city_en || "" };
    });
    _stadiums = map;
  } catch { _stadiums = {}; }
  return _stadiums;
}

async function getGames() {
  const [data, stadiums] = await Promise.all([
    fetchJSON(`${API_BASE}/games`),
    getStadiums()
  ]);
  const list = data.games || data || [];
  return list.map(g => {
    const homeName = g.home_team_name_en || g.home_team_label || "Por definir";
    const awayName = g.away_team_name_en || g.away_team_label || "Por definir";
    const venue = stadiums[String(g.stadium_id)] || { name: "", city: "" };
    const score = (v) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    };
    const status = mapStatus(g);
    const isLive = status.short === "LIVE";
    const played = status.short === "FT" || isLive;
    return {
      fixture: {
        id: g.id,
        date: parseLocalDate(g.local_date)?.toISOString() || g.local_date,
        status,
        venue
      },
      league: {
        round: g.type === "group" ? `Grupo ${g.group}` : (g.group || g.type || "")
      },
      teams: {
        home: { name: homeName, logo: flag(homeName) },
        away: { name: awayName, logo: flag(awayName) }
      },
      goals: {
        home: played ? score(g.home_score) : null,
        away: played ? score(g.away_score) : null
      },
      _raw: g
    };
  });
}

async function getStandings() {
  const data = await fetchJSON(`${API_BASE}/groups`);
  return data.groups || [];
}

/* ====================================================
   DEMO FALLBACK
==================================================== */
const DEMO = {
  fixtures: [
    {
      fixture: { id: "demo1", date: new Date().toISOString(),
        status: { short: "NS", elapsed: null },
        venue: { name: "Estadio Azteca", city: "Ciudad de México" } },
      league: { round: "Grupo A" },
      teams: { home: { name: "Mexico", logo: flag("Mexico") },
               away: { name: "Argentina", logo: flag("Argentina") } },
      goals: { home: null, away: null }
    }
  ],
  standings: [],
  scorers: []
};

/* ====================================================
   ESTADO
==================================================== */
const state = {
  fixtures: [],
  standings: [],
  scorers: [],
  usingDemo: false,
  lastUpdate: null,
  tab: "matches",
  prevGoals: {},
  soundOn: false,
  filters: { team: "", group: "", status: "", date: "" }
};

function detectGoalChanges(fixtures) {
  fixtures.forEach(f => {
    const id = f.fixture.id;
    const total = (f.goals.home || 0) + (f.goals.away || 0);
    if (state.prevGoals[id] !== undefined && total > state.prevGoals[id]) {
      toast("¡GOL!", `${f.teams.home.name} ${f.goals.home} - ${f.goals.away} ${f.teams.away.name}`, "goal");
      if (state.soundOn) document.getElementById("goalSound")?.play().catch(() => {});
    }
    state.prevGoals[id] = total;
  });
}

/* ====================================================
   CARGAR
==================================================== */
async function loadAll() {
  try {
    const [fixtures, standings] = await Promise.all([getGames(), getStandings()]);
    detectGoalChanges(fixtures);
    state.fixtures = fixtures;
    state.standings = standings;
    state.scorers = [];
    state.usingDemo = false;
    state.lastUpdate = new Date();
    render();
  } catch (e) {
    console.error(e);
    state.fixtures = DEMO.fixtures;
    state.standings = DEMO.standings;
    state.scorers = DEMO.scorers;
    state.usingDemo = true;
    state.lastUpdate = new Date();
    render();
    toast("Error", "No se pudieron cargar los datos", "error");
  }
}

/* ====================================================
   RENDER
==================================================== */
function fmtTime(d) {
  const x = new Date(d);
  return x.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d) {
  const x = new Date(d);
  return x.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}
function isSameDay(a, b) {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

function statusBadge(s) {
  if (s.short === "LIVE") return `<span class="badge live"><span class="live-dot"></span>EN VIVO</span>`;
  if (s.short === "FT") return `<span class="badge ft">FINAL</span>`;
  return `<span class="badge ns">Próximo</span>`;
}

function matchCard(f) {
  const s = f.fixture.status;
  const showScore = s.short === "LIVE" || s.short === "FT";
  const home = f.teams.home, away = f.teams.away;
  const score = showScore
    ? `<div class="score">${f.goals.home ?? 0} <span>-</span> ${f.goals.away ?? 0}</div>`
    : `<div class="score time">${fmtTime(f.fixture.date)}</div>`;
  return `
    <article class="match-card" data-id="${f.fixture.id}">
      <header class="match-head">
        ${statusBadge(s)}
        <span class="round">${f.league.round || ""}</span>
      </header>
      <div class="match-body">
        <div class="team home">
          ${home.logo ? `<img src="${home.logo}" alt="${home.name}" loading="lazy"/>` : `<div class="flag-fallback"></div>`}
          <span>${home.name}</span>
        </div>
        ${score}
        <div class="team away">
          ${away.logo ? `<img src="${away.logo}" alt="${away.name}" loading="lazy"/>` : `<div class="flag-fallback"></div>`}
          <span>${away.name}</span>
        </div>
      </div>
      <footer class="match-foot">
        <span>📅 ${fmtDate(f.fixture.date)}</span>
        ${f.fixture.venue.name ? `<span>📍 ${f.fixture.venue.name}${f.fixture.venue.city ? `, ${f.fixture.venue.city}` : ""}</span>` : ""}
      </footer>
    </article>
  `;
}

function applyFilters(list) {
  const { team, group, status, date } = state.filters;
  return list.filter(f => {
    if (team) {
      const t = team.toLowerCase();
      if (!f.teams.home.name.toLowerCase().includes(t) && !f.teams.away.name.toLowerCase().includes(t)) return false;
    }
    if (group && !(f.league.round || "").toLowerCase().includes(group.toLowerCase())) return false;
    if (status) {
      const s = f.fixture.status.short;
      if (status === "LIVE" && s !== "LIVE") return false;
      if (status === "NS" && s !== "NS") return false;
      if (status === "FT" && s !== "FT") return false;
    }
    if (date) {
      if (!isSameDay(f.fixture.date, date)) return false;
    }
    return true;
  });
}

function renderMatches() {
  const el = document.getElementById("matches");
  const list = applyFilters(state.fixtures)
    .slice()
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
  el.innerHTML = list.length
    ? list.map(matchCard).join("")
    : `<div class="empty">Sin partidos para los filtros seleccionados.</div>`;
}

function renderUpcoming() {
  const now = Date.now();
  const list = state.fixtures
    .filter(f => f.fixture.status.short === "NS" && new Date(f.fixture.date).getTime() >= now - 3600000)
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
    .slice(0, 24);
  document.getElementById("upcoming").innerHTML = list.length
    ? list.map(matchCard).join("")
    : `<div class="empty">No hay próximos partidos.</div>`;
}

function renderResults() {
  const list = state.fixtures
    .filter(f => f.fixture.status.short === "FT")
    .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
    .slice(0, 30);
  document.getElementById("results").innerHTML = list.length
    ? list.map(matchCard).join("")
    : `<div class="empty">Aún no hay resultados.</div>`;
}

function teamNameById(id) {
  for (const f of state.fixtures) {
    if (f._raw?.home_team_id === id) return f.teams.home.name;
    if (f._raw?.away_team_id === id) return f.teams.away.name;
  }
  return `Equipo ${id}`;
}

function renderStandings() {
  const el = document.getElementById("standings");
  if (!state.standings.length) {
    el.innerHTML = `<div class="empty">Sin datos de posiciones.</div>`;
    return;
  }
  const groups = state.standings.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  el.innerHTML = groups.map(g => {
    const rows = (g.teams || [])
      .slice()
      .sort((a, b) => (+b.pts) - (+a.pts) || (+b.gd) - (+a.gd) || (+b.gf) - (+a.gf))
      .map((t, i) => {
        const name = teamNameById(String(t.team_id));
        const lg = flag(name);
        return `<tr>
          <td>${i + 1}</td>
          <td class="team-cell">${lg ? `<img src="${lg}" alt=""/>` : ""}<span>${name}</span></td>
          <td>${t.mp}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
          <td>${t.gf}</td><td>${t.ga}</td><td>${t.gd}</td>
          <td><strong>${t.pts}</strong></td>
        </tr>`;
      }).join("");
    return `
      <div class="standing-card">
        <h3>Grupo ${g.name}</h3>
        <table class="standing-table">
          <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");
}

function renderScorers() {
  document.getElementById("scorers").innerHTML =
    `<div class="empty">Los datos de goleadores no están disponibles en esta fuente.</div>`;
}

function renderDashboard() {
  const live = state.fixtures.filter(f => f.fixture.status.short === "LIVE");
  const today = state.fixtures.filter(f => isSameDay(f.fixture.date, new Date()));
  const goalsToday = today.reduce((s, f) => s + (f.goals.home || 0) + (f.goals.away || 0), 0);
  const next = state.fixtures
    .filter(f => f.fixture.status.short === "NS" && new Date(f.fixture.date).getTime() >= Date.now())
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))[0];

  document.getElementById("stat-live").textContent = live.length;
  document.getElementById("stat-goals").textContent = goalsToday;
  document.getElementById("stat-total").textContent = state.fixtures.length;
  document.getElementById("stat-next").textContent =
    next ? `${next.teams.home.name} vs ${next.teams.away.name}` : "—";
  document.getElementById("stat-next-time").textContent =
    next ? `${fmtDate(next.fixture.date)} · ${fmtTime(next.fixture.date)}` : "—";
  document.getElementById("stat-updated").textContent =
    state.lastUpdate ? fmtTime(state.lastUpdate) : "—";
}

function populateGroupFilter() {
  const sel = document.getElementById("f-group");
  if (!sel || sel.dataset.ready) return;
  const groups = Array.from(new Set(state.fixtures.map(f => f.league.round).filter(Boolean))).sort();
  sel.innerHTML = `<option value="">Todos los grupos</option>` +
    groups.map(g => `<option value="${g}">${g}</option>`).join("");
  sel.dataset.ready = "1";
}

function render() {
  renderDashboard();
  populateGroupFilter();
  renderMatches();
  renderStandings();
  renderScorers();
  renderUpcoming();
  renderResults();
}

/* ====================================================
   TABS / MODAL / TOAST / INTERACCIÓN
==================================================== */
function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.tab;
      document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".tab-panel").forEach(p =>
        p.classList.toggle("active", p.id === `panel-${t}`));
      state.tab = t;
    });
  });
}

function setupFilters() {
  const t = document.getElementById("f-team");
  const g = document.getElementById("f-group");
  const s = document.getElementById("f-status");
  const d = document.getElementById("f-date");
  const c = document.getElementById("f-clear");
  const upd = () => { renderMatches(); };
  t?.addEventListener("input", e => { state.filters.team = e.target.value; upd(); });
  g?.addEventListener("change", e => { state.filters.group = e.target.value; upd(); });
  s?.addEventListener("change", e => { state.filters.status = e.target.value; upd(); });
  d?.addEventListener("change", e => { state.filters.date = e.target.value; upd(); });
  c?.addEventListener("click", () => {
    state.filters = { team: "", group: "", status: "", date: "" };
    if (t) t.value = ""; if (g) g.value = ""; if (s) s.value = ""; if (d) d.value = "";
    upd();
  });
}

function setupModal() {
  document.addEventListener("click", e => {
    const card = e.target.closest(".match-card");
    if (card) openModal(card.dataset.id);
    if (e.target.matches("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
}
function openModal(id) {
  const f = state.fixtures.find(x => String(x.fixture.id) === String(id));
  if (!f) return;
  const body = document.getElementById("modal-body");
  const s = f.fixture.status;
  body.innerHTML = `
    <div class="modal-head">
      ${statusBadge(s)}
      <span class="round">${f.league.round || ""}</span>
    </div>
    <div class="modal-teams">
      <div class="team">
        ${f.teams.home.logo ? `<img src="${f.teams.home.logo}" alt=""/>` : ""}
        <h3>${f.teams.home.name}</h3>
      </div>
      <div class="modal-score">
        ${(s.short === "LIVE" || s.short === "FT")
          ? `${f.goals.home ?? 0} - ${f.goals.away ?? 0}`
          : fmtTime(f.fixture.date)}
      </div>
      <div class="team">
        ${f.teams.away.logo ? `<img src="${f.teams.away.logo}" alt=""/>` : ""}
        <h3>${f.teams.away.name}</h3>
      </div>
    </div>
    <ul class="modal-meta">
      <li><strong>Fecha:</strong> ${fmtDate(f.fixture.date)} · ${fmtTime(f.fixture.date)}</li>
      ${f.fixture.venue.name ? `<li><strong>Estadio:</strong> ${f.fixture.venue.name}</li>` : ""}
      ${f.fixture.venue.city ? `<li><strong>Ciudad:</strong> ${f.fixture.venue.city}</li>` : ""}
    </ul>
  `;
  document.getElementById("modal").hidden = false;
}
function closeModal() { document.getElementById("modal").hidden = true; }

function toast(title, msg, type = "info") {
  const wrap = document.getElementById("toasts");
  if (!wrap) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<strong>${title}</strong><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 4000);
}

function setupClock() {
  const el = document.getElementById("clock");
  const tick = () => { if (el) el.textContent = new Date().toLocaleTimeString("es-AR"); };
  tick(); setInterval(tick, 1000);
}

function setupHeader() {
  document.getElementById("refreshBtn")?.addEventListener("click", () => loadAll());
  document.getElementById("soundToggle")?.addEventListener("click", (e) => {
    state.soundOn = !state.soundOn;
    e.currentTarget.classList.toggle("active", state.soundOn);
    e.currentTarget.textContent = state.soundOn ? "🔊" : "🔔";
  });
}

/* ====================================================
   INIT
==================================================== */
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupFilters();
  setupModal();
  setupClock();
  setupHeader();
  loadAll();
  setInterval(loadAll, REFRESH_MS);
});
