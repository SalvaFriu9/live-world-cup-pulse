/* =========================================================
   MUNDIAL 2026 EN VIVO
   App vanilla JS · API-Football (vía Edge Function proxy)
========================================================= */

// 🔒 La API_KEY de API-Football vive en el servidor (Edge Function "api-football").
const SUPABASE_URL = "https://xezdzskdvuntyzzyxdma.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlemR6c2tkdnVudHl6enl4ZG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTA1NTAsImV4cCI6MjA5NzM4NjU1MH0.028AyOSHpkZPnVjlGNXTZ6T1CrJ_BZdajmQdsCyB-fY";
const API_BASE = `${SUPABASE_URL}/functions/v1/api-football`;
const LEAGUE_ID = 1;
const SEASON = 2026;
const REFRESH_MS = 30_000;
const CACHE_TTL = 60_000;
const STORAGE_PREFIX = "wc2026_";

/* ---------- ESTADO GLOBAL ---------- */
const state = {
  fixtures: [],
  standings: [],
  scorers: [],
  filters: { team: "", group: "", status: "", date: "" },
  previousScores: new Map(),
  soundEnabled: false,
  lastUpdate: null,
  usingDemo: false,
};

/* ---------- HELPERS ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const fmt = (n) => String(n ?? 0);
const pad = (n) => String(n).padStart(2, "0");
const formatDate = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const formatTime = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const isLive = (s) => ["1H", "2H", "HT", "ET", "P", "BT", "LIVE"].includes(s);
const isFinished = (s) => ["FT", "AET", "PEN"].includes(s);
const flagUrl = (code) => code ? `https://flagcdn.com/w80/${code.toLowerCase()}.png` : "https://flagcdn.com/w80/un.png";

/* ---------- CACHE ---------- */
function cacheGet(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}
function cacheSet(key, data) {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ t: Date.now(), data })); } catch {}
}

/* ---------- API CALL (con reintentos) ---------- */
async function apiCall(endpoint, params = {}, { retries = 2, useCache = true } = {}) {
  const qs = new URLSearchParams(params).toString();
  const key = endpoint + "?" + qs;
  if (useCache) {
    const cached = cacheGet(key);
    if (cached) return cached;
  }

  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const ep = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
      const res = await fetch(`${API_BASE}${ep}?${qs}`, {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      cacheSet(key, json.response || []);
      return json.response || [];
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

/* ---------- DATOS DEMO (fallback) ---------- */
const DEMO = {
  fixtures: [
    { fixture: { id: 1, date: new Date(Date.now() + 3600e3).toISOString(), status: { short: "NS", elapsed: null }, venue: { name: "MetLife Stadium", city: "Nueva Jersey" }, referee: "Szymon Marciniak" }, league: { round: "Group A - 1" }, teams: { home: { name: "México", logo: flagUrl("mx") }, away: { name: "Canadá", logo: flagUrl("ca") } }, goals: { home: null, away: null } },
    { fixture: { id: 2, date: new Date().toISOString(), status: { short: "1H", elapsed: 23 }, venue: { name: "SoFi Stadium", city: "Los Ángeles" }, referee: "Anthony Taylor" }, league: { round: "Group B - 1" }, teams: { home: { name: "Argentina", logo: flagUrl("ar") }, away: { name: "Brasil", logo: flagUrl("br") } }, goals: { home: 1, away: 0 } },
    { fixture: { id: 3, date: new Date().toISOString(), status: { short: "2H", elapsed: 67 }, venue: { name: "Estadio Azteca", city: "CDMX" }, referee: "Daniele Orsato" }, league: { round: "Group C - 1" }, teams: { home: { name: "España", logo: flagUrl("es") }, away: { name: "Francia", logo: flagUrl("fr") } }, goals: { home: 2, away: 2 } },
    { fixture: { id: 4, date: new Date(Date.now() - 86400e3).toISOString(), status: { short: "FT", elapsed: 90 }, venue: { name: "BC Place", city: "Vancouver" }, referee: "Clément Turpin" }, league: { round: "Group D - 1" }, teams: { home: { name: "Inglaterra", logo: flagUrl("gb") }, away: { name: "Alemania", logo: flagUrl("de") } }, goals: { home: 3, away: 1 } },
    { fixture: { id: 5, date: new Date(Date.now() + 2 * 86400e3).toISOString(), status: { short: "NS", elapsed: null }, venue: { name: "AT&T Stadium", city: "Dallas" }, referee: "Por designar" }, league: { round: "Group E - 1" }, teams: { home: { name: "Portugal", logo: flagUrl("pt") }, away: { name: "Uruguay", logo: flagUrl("uy") } }, goals: { home: null, away: null } },
    { fixture: { id: 6, date: new Date().toISOString(), status: { short: "HT", elapsed: 45 }, venue: { name: "Mercedes-Benz Stadium", city: "Atlanta" }, referee: "Facundo Tello" }, league: { round: "Group F - 1" }, teams: { home: { name: "Países Bajos", logo: flagUrl("nl") }, away: { name: "Italia", logo: flagUrl("it") } }, goals: { home: 1, away: 1 } },
  ],
  standings: ["A", "B", "C"].map((g) => ({
    group: `Group ${g}`,
    teams: [
      { rank: 1, team: { name: "Equipo 1", logo: flagUrl("ar") }, all: { played: 2, win: 2, draw: 0, lose: 0, goals: { for: 5, against: 1 } }, points: 6, goalsDiff: 4 },
      { rank: 2, team: { name: "Equipo 2", logo: flagUrl("br") }, all: { played: 2, win: 1, draw: 1, lose: 0, goals: { for: 3, against: 2 } }, points: 4, goalsDiff: 1 },
      { rank: 3, team: { name: "Equipo 3", logo: flagUrl("mx") }, all: { played: 2, win: 0, draw: 1, lose: 1, goals: { for: 1, against: 2 } }, points: 1, goalsDiff: -1 },
      { rank: 4, team: { name: "Equipo 4", logo: flagUrl("ca") }, all: { played: 2, win: 0, draw: 0, lose: 2, goals: { for: 0, against: 4 } }, points: 0, goalsDiff: -4 },
    ],
  })),
  scorers: Array.from({ length: 10 }, (_, i) => ({
    player: { name: `Jugador ${i + 1}`, photo: "" },
    statistics: [{ team: { name: "Selección", logo: flagUrl(["ar","br","fr","es","de","pt","mx","nl","it","uy"][i]) }, goals: { total: 8 - Math.floor(i / 2), assists: i % 3 } }],
  })),
};

/* ---------- FETCH DE DATOS ---------- */
async function loadAll() {
  try {
    const [fixtures, standings, scorers] = await Promise.all([
      apiCall("/fixtures", { league: LEAGUE_ID, season: SEASON }),
      apiCall("/standings", { league: LEAGUE_ID, season: SEASON }).then(r => r[0]?.league?.standings || []),
      apiCall("/players/topscorers", { league: LEAGUE_ID, season: SEASON }),
    ]);

    detectGoalChanges(fixtures);
    state.fixtures = fixtures?.length ? fixtures : DEMO.fixtures;
    state.standings = standings?.length ? standings : DEMO.standings;
    state.scorers = scorers?.length ? scorers : DEMO.scorers;
    state.lastUpdate = new Date();
    state.usingDemo = !fixtures?.length;
    render();
  } catch (e) {
    console.error(e);
    state.fixtures = DEMO.fixtures;
    state.standings = DEMO.standings;
    state.scorers = DEMO.scorers;
    state.usingDemo = true;
    state.lastUpdate = new Date();
    render();
    toast("Error de conexión", "Mostrando datos demo. Reintentando…", "error");
  }
}

function detectGoalChanges(newFixtures) {
  newFixtures.forEach((f) => {
    const id = f.fixture.id;
    const prev = state.previousScores.get(id);
    const cur = `${f.goals.home ?? 0}-${f.goals.away ?? 0}`;
    if (prev && prev !== cur && isLive(f.fixture.status.short)) {
      const msg = `${f.teams.home.name} ${f.goals.home ?? 0} - ${f.goals.away ?? 0} ${f.teams.away.name}`;
      toast("⚽ ¡GOL!", msg, "goal");
      playGoal();
      const card = document.querySelector(`[data-mid="${id}"]`);
      if (card) { card.classList.add("updated"); setTimeout(() => card.classList.remove("updated"), 1200); }
    }
    state.previousScores.set(id, cur);
  });
}

/* ---------- RENDER PRINCIPAL ---------- */
function render() {
  renderDashboard();
  renderMatches();
  renderStandings();
  renderScorers();
  renderUpcoming();
  renderResults();
  renderGroupFilter();
}

function renderDashboard() {
  const live = state.fixtures.filter(f => isLive(f.fixture.status.short));
  const today = new Date().toDateString();
  const todayMatches = state.fixtures.filter(f => new Date(f.fixture.date).toDateString() === today);
  const goalsToday = todayMatches.reduce((s, f) => s + (f.goals.home ?? 0) + (f.goals.away ?? 0), 0);
  const next = state.fixtures
    .filter(f => f.fixture.status.short === "NS" && new Date(f.fixture.date) > new Date())
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))[0];

  $("#stat-live").textContent = live.length;
  $("#stat-goals").textContent = goalsToday;
  $("#stat-total").textContent = state.fixtures.length;
  $("#stat-teams").textContent = "48";
  $("#stat-next").textContent = next ? `${next.teams.home.name} vs ${next.teams.away.name}` : "—";
  $("#stat-next-time").textContent = next ? `${formatDate(next.fixture.date)} · ${formatTime(next.fixture.date)}` : "—";
  $("#stat-updated").textContent = state.lastUpdate ? formatTime(state.lastUpdate) + ":" + pad(state.lastUpdate.getSeconds()) : "—";
}

/* ---------- MATCH CARD ---------- */
function matchCard(f) {
  const s = f.fixture.status.short;
  const live = isLive(s);
  const ft = isFinished(s);
  const group = (f.league.round || "").replace(/Group ([A-Z]).*/, "Grupo $1");
  const statusHtml = live
    ? `<span class="mc-status live"><span class="blink"></span>${s === "HT" ? "DESCANSO" : `${f.fixture.status.elapsed || 0}'`}</span>`
    : ft
      ? `<span class="mc-status ft">FINAL</span>`
      : `<span class="mc-status ns">${formatTime(f.fixture.date)}</span>`;

  const score = live || ft
    ? `${fmt(f.goals.home)} <span class="vs">-</span> ${fmt(f.goals.away)}`
    : `<span class="vs">VS</span>`;

  return `<div class="match-card ${live ? "live" : ""}" data-mid="${f.fixture.id}">
    <div class="mc-head">
      ${statusHtml}
      ${group ? `<span class="mc-group">${group}</span>` : ""}
    </div>
    <div class="mc-teams">
      <div class="mc-team">
        <img src="${f.teams.home.logo}" alt="${f.teams.home.name}" loading="lazy" />
        <div class="name">${f.teams.home.name}</div>
      </div>
      <div class="mc-score">${score}</div>
      <div class="mc-team">
        <img src="${f.teams.away.logo}" alt="${f.teams.away.name}" loading="lazy" />
        <div class="name">${f.teams.away.name}</div>
      </div>
    </div>
    <div class="mc-foot">
      <span>📅 ${formatDate(f.fixture.date)}</span>
      <span>🏟️ ${f.fixture.venue?.name || "—"}</span>
      ${f.fixture.venue?.city ? `<span>📍 ${f.fixture.venue.city}</span>` : ""}
      ${f.fixture.referee ? `<span>🧑‍⚖️ ${f.fixture.referee}</span>` : ""}
    </div>
  </div>`;
}

/* ---------- LISTAS ---------- */
function applyFilters(list) {
  const { team, group, status, date } = state.filters;
  return list.filter(f => {
    if (team) {
      const t = team.toLowerCase();
      if (!f.teams.home.name.toLowerCase().includes(t) && !f.teams.away.name.toLowerCase().includes(t)) return false;
    }
    if (group && !(f.league.round || "").includes(group)) return false;
    if (status) {
      if (status === "LIVE" && !isLive(f.fixture.status.short)) return false;
      if (status === "NS" && f.fixture.status.short !== "NS") return false;
      if (status === "FT" && !isFinished(f.fixture.status.short)) return false;
    }
    if (date && new Date(f.fixture.date).toISOString().slice(0, 10) !== date) return false;
    return true;
  });
}

function renderMatches() {
  const list = applyFilters(state.fixtures).sort((a, b) => {
    const la = isLive(a.fixture.status.short) ? 0 : 1;
    const lb = isLive(b.fixture.status.short) ? 0 : 1;
    if (la !== lb) return la - lb;
    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });
  const el = $("#matches");
  if (!list.length) { el.innerHTML = emptyState("No hay partidos con esos filtros"); return; }
  el.innerHTML = list.map(matchCard).join("");
  bindCards(el);
}

function renderUpcoming() {
  const list = state.fixtures.filter(f => f.fixture.status.short === "NS" && new Date(f.fixture.date) > new Date())
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date)).slice(0, 30);
  const el = $("#upcoming");
  el.innerHTML = list.length ? list.map(matchCard).join("") : emptyState("Sin próximos partidos");
  bindCards(el);
}

function renderResults() {
  const list = state.fixtures.filter(f => isFinished(f.fixture.status.short))
    .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date)).slice(0, 30);
  const el = $("#results");
  el.innerHTML = list.length ? list.map(matchCard).join("") : emptyState("Aún no hay resultados");
  bindCards(el);
}

function renderStandings() {
  const el = $("#standings");
  if (!state.standings.length) { el.innerHTML = emptyState("Posiciones no disponibles"); return; }
  const groups = Array.isArray(state.standings[0]) ? state.standings : state.standings.map(g => g.teams || g);
  el.innerHTML = groups.map((grp, i) => {
    const groupName = grp[0]?.group || `Grupo ${String.fromCharCode(65 + i)}`;
    const rows = grp.map(t => `<tr class="${t.rank <= 2 ? "qualified" : ""}">
      <td class="team"><img src="${t.team.logo}" alt=""/>${t.team.name}</td>
      <td>${t.all.played}</td>
      <td>${t.all.win}</td>
      <td>${t.all.draw}</td>
      <td>${t.all.lose}</td>
      <td>${t.all.goals.for}:${t.all.goals.against}</td>
      <td>${t.goalsDiff > 0 ? "+" : ""}${t.goalsDiff}</td>
      <td><strong>${t.points}</strong></td>
    </tr>`).join("");
    return `<div class="group-card">
      <div class="group-head">${groupName}</div>
      <table class="group-table">
        <thead><tr><th style="text-align:left">Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF:GC</th><th>DG</th><th>Pts</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join("");
}

function renderScorers() {
  const el = $("#scorers");
  if (!state.scorers.length) { el.innerHTML = emptyState("Sin goleadores aún"); return; }
  el.innerHTML = state.scorers.slice(0, 20).map((p, i) => {
    const st = p.statistics[0];
    return `<div class="scorer-row">
      <div class="scorer-rank">${i + 1}</div>
      <div class="scorer-info">
        <div class="name">${p.player.name}</div>
        <div class="team"><img src="${st.team.logo}" alt=""/>${st.team.name}</div>
      </div>
      <div class="scorer-goals">${st.goals.total ?? 0}<small>${st.goals.assists ?? 0} asistencias</small></div>
    </div>`;
  }).join("");
}

function renderGroupFilter() {
  const sel = $("#f-group");
  if (sel.options.length > 1) return;
  const groups = [...new Set(state.fixtures.map(f => (f.league.round || "").match(/Group [A-Z]/)?.[0]).filter(Boolean))].sort();
  groups.forEach(g => {
    const o = document.createElement("option");
    o.value = g; o.textContent = g.replace("Group", "Grupo");
    sel.appendChild(o);
  });
}

function emptyState(msg) {
  return `<div class="empty"><div class="ico">📭</div>${msg}</div>`;
}

function skeletonGrid(n = 6) {
  return Array.from({ length: n }, () => `<div class="skeleton"></div>`).join("");
}

/* ---------- MODAL DETALLE + ESTADÍSTICAS ---------- */
function bindCards(container) {
  container.querySelectorAll(".match-card").forEach(c => {
    c.addEventListener("click", () => openMatchModal(c.dataset.mid));
  });
}

async function openMatchModal(id) {
  const f = state.fixtures.find(x => String(x.fixture.id) === String(id));
  if (!f) return;
  $("#modal").hidden = false;
  $("#modal-body").innerHTML = `<h2 style="margin-top:0">${f.teams.home.name} ${fmt(f.goals.home)} - ${fmt(f.goals.away)} ${f.teams.away.name}</h2>
    <p style="color:var(--muted);margin-top:-8px">${formatDate(f.fixture.date)} · ${formatTime(f.fixture.date)} · ${f.fixture.venue?.name || ""}</p>
    <div id="modal-stats"><div class="skeleton" style="height:200px"></div></div>`;

  let stats = [];
  try { stats = await apiCall("/fixtures/statistics", { fixture: id }); } catch {}
  renderStatsModal(stats, f);
}

function renderStatsModal(stats, f) {
  const el = $("#modal-stats");
  const labels = {
    "Ball Possession": "Posesión", "Total Shots": "Tiros", "Shots on Goal": "Tiros al arco",
    "Corner Kicks": "Córners", "Fouls": "Faltas", "Yellow Cards": "Amarillas",
    "Red Cards": "Rojas", "Offsides": "Fueras de juego", "expected_goals": "xG",
    "Goalkeeper Saves": "Atajadas",
  };
  if (!stats || stats.length < 2) {
    el.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px">Estadísticas no disponibles para este partido.</p>`;
    return;
  }
  const [home, away] = stats;
  const rows = home.statistics.map(s => {
    const a = away.statistics.find(x => x.type === s.type)?.value ?? 0;
    const hVal = parseFloat(String(s.value ?? 0)) || 0;
    const aVal = parseFloat(String(a)) || 0;
    const total = hVal + aVal || 1;
    return `<div class="stats-row">
      <div style="text-align:right">
        <div class="stat-num">${s.value ?? 0}</div>
        <div class="stat-bar right"><div class="stat-bar-fill" style="width:${(hVal/total)*100}%"></div></div>
      </div>
      <div class="stat-label-center">${labels[s.type] || s.type}</div>
      <div>
        <div class="stat-num">${a}</div>
        <div class="stat-bar"><div class="stat-bar-fill" style="width:${(aVal/total)*100}%"></div></div>
      </div>
    </div>`;
  }).join("");
  el.innerHTML = rows;
}

/* ---------- TOAST ---------- */
function toast(title, msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<strong>${title}</strong>${msg}`;
  $("#toasts").appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .4s"; }, 4500);
  setTimeout(() => el.remove(), 5000);
}

/* ---------- SONIDO ---------- */
function playGoal() {
  if (!state.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = freq; o.type = "triangle";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.15 + 0.35);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.15); o.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
  } catch {}
}

/* ---------- RELOJ ---------- */
function tickClock() {
  const d = new Date();
  $("#clock").textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ---------- EVENTOS ---------- */
function bindEvents() {
  $$("#tabs .tab").forEach(t => {
    t.addEventListener("click", () => {
      $$("#tabs .tab").forEach(x => x.classList.remove("active"));
      $$(".tab-panel").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      $(`#panel-${t.dataset.tab}`).classList.add("active");
    });
  });

  ["f-team", "f-group", "f-status", "f-date"].forEach(id => {
    $("#" + id).addEventListener("input", (e) => {
      state.filters[id.replace("f-", "")] = e.target.value;
      renderMatches();
    });
  });
  $("#f-clear").addEventListener("click", () => {
    state.filters = { team: "", group: "", status: "", date: "" };
    ["f-team", "f-group", "f-status", "f-date"].forEach(id => $("#" + id).value = "");
    renderMatches();
  });

  $("#refreshBtn").addEventListener("click", () => {
    localStorage.clear();
    $("#matches").innerHTML = skeletonGrid();
    loadAll();
  });

  $("#soundToggle").addEventListener("click", (e) => {
    state.soundEnabled = !state.soundEnabled;
    e.currentTarget.textContent = state.soundEnabled ? "🔊" : "🔔";
    toast("Sonido", state.soundEnabled ? "Notificaciones de gol activadas" : "Sonido desactivado");
  });

  $$("#modal [data-close]").forEach(b => b.addEventListener("click", () => $("#modal").hidden = true));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#modal").hidden = true; });
}

/* ---------- INIT ---------- */
function init() {
  bindEvents();
  tickClock(); setInterval(tickClock, 1000);
  $("#matches").innerHTML = skeletonGrid();
  loadAll();
  setInterval(loadAll, REFRESH_MS);
}
document.addEventListener("DOMContentLoaded", init);
