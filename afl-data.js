/*
 * AFL data access layer.
 *
 * Prefers LIVE data from the Squiggle API (proxied through this app's
 * /api/afl endpoint so the required User-Agent and caching are handled
 * server-side). If the network is unreachable — e.g. a restricted egress
 * sandbox, or opening index.html with no server — every method falls back
 * to the bundled offline 2024 snapshot in data.js.
 *
 * Squiggle is a free community API (https://api.squiggle.com.au). It provides
 * game scores (live + historical back to 1897) and ladders, but NOT
 * player-level live statistics, which no free public source exposes.
 */
const AflData = (() => {
  const PROXY = "/api/afl";
  const FIRST_SEASON = 1897;
  let source = "unknown"; // "live" | "offline"

  /* ---- canonical team registry (names ⇄ abbr ⇄ colour) ---- */
  const TEAM_META = [
    ["Adelaide",              "Adelaide Crows",     "ADE", "#002b5c"],
    ["Brisbane Lions",        "Brisbane Lions",     "BL",  "#7a0026"],
    ["Carlton",               "Carlton",            "CAR", "#031a3a"],
    ["Collingwood",           "Collingwood",        "COL", "#111111"],
    ["Essendon",              "Essendon",           "ESS", "#cc2031"],
    ["Fremantle",             "Fremantle",          "FRE", "#2e1a47"],
    ["Geelong",               "Geelong Cats",       "GEE", "#1f3c70"],
    ["Gold Coast",            "Gold Coast Suns",    "GC",  "#d11a2a"],
    ["Greater Western Sydney","GWS Giants",         "GWS", "#f47920"],
    ["Hawthorn",              "Hawthorn",           "HAW", "#4d2004"],
    ["Melbourne",             "Melbourne",          "MEL", "#0f1131"],
    ["North Melbourne",       "North Melbourne",    "NM",  "#1a3a8f"],
    ["Port Adelaide",         "Port Adelaide",      "PA",  "#01b5b5"],
    ["Richmond",              "Richmond",           "RIC", "#f2c200"],
    ["St Kilda",              "St Kilda",           "STK", "#ed1b2f"],
    ["Sydney",                "Sydney Swans",       "SYD", "#e1242a"],
    ["West Coast",            "West Coast Eagles",  "WCE", "#003087"],
    ["Western Bulldogs",      "Western Bulldogs",   "WB",  "#0039a6"],
  ];
  // historical/alternate names the API has used over time
  const ALIASES = {
    "Kangaroos": "NM", "Footscray": "WB", "South Melbourne": "SYD",
    "Brisbane Bears": "BL", "Fitzroy": "FITZ", "University": "UNI",
  };
  const byKey = {};
  TEAM_META.forEach(([sq, disp, abbr, color]) => {
    byKey[sq.toLowerCase()] = { abbr, name: disp, color };
    byKey[disp.toLowerCase()] = { abbr, name: disp, color };
    byKey[abbr.toLowerCase()] = { abbr, name: disp, color };
  });
  /** Resolve any team name/abbr the API throws at us → {abbr,name,color}. */
  function team(nameOrAbbr) {
    if (!nameOrAbbr) return { abbr: "?", name: "Unknown", color: "#888" };
    const k = String(nameOrAbbr).toLowerCase();
    if (byKey[k]) return byKey[k];
    const alias = ALIASES[nameOrAbbr];
    if (alias && byKey[alias.toLowerCase()]) return byKey[alias.toLowerCase()];
    return { abbr: nameOrAbbr.slice(0, 3).toUpperCase(), name: nameOrAbbr, color: "#888" };
  }
  const colorOf = (abbr) => (byKey[String(abbr).toLowerCase()] || {}).color || "#888";

  /* ---- low-level proxied query with in-memory + sessionStorage cache ---- */
  const mem = new Map();
  async function squiggle(q, { ttl = 30000 } = {}) {
    const now = Date.now();
    const hit = mem.get(q);
    if (hit && now - hit.t < ttl) return hit.v;

    const res = await fetch(`${PROXY}?q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const data = await res.json();
    mem.set(q, { t: now, v: data });
    source = "live";
    return data;
  }

  /* ---- normalisers ---- */
  function normStanding(s) {
    const meta = team(s.team || s.name);
    const pf = +s.for || 0, pa = +s.against || 0;
    return {
      rank: +s.rank, name: meta.name, abbr: meta.abbr,
      played: +s.played || 0, w: +s.wins || 0, l: +s.losses || 0, d: +s.draws || 0,
      pf, pa, pts: s.pts != null ? +s.pts : (+s.wins || 0) * 4 + (+s.draws || 0) * 2,
      pct: pa ? (pf / pa) * 100 : 0,
    };
  }
  function normGame(g) {
    const h = team(g.hteam), a = team(g.ateam);
    const complete = +g.complete || 0;
    return {
      id: g.id, year: +g.year, round: +g.round, roundname: g.roundname,
      date: g.date, venue: g.venue, complete,
      status: complete >= 100 ? "complete" : complete > 0 ? "live" : "upcoming",
      timestr: g.timestr || "", // e.g. "Q3 12:01" while live
      home: { ...h, score: g.hscore != null ? +g.hscore : null, goals: +g.hgoals || 0, behinds: +g.hbehinds || 0 },
      away: { ...a, score: g.ascore != null ? +g.ascore : null, goals: +g.agoals || 0, behinds: +g.abehinds || 0 },
      winner: g.winner ? team(g.winner).name : null,
    };
  }

  /* ---- offline fallback (from data.js) ---- */
  function offlineStandings() {
    source = "offline";
    return ladder().map((t, i) => ({
      rank: i + 1, name: t.name, abbr: t.abbr, played: gamesPlayed(t),
      w: t.w, l: t.l, d: t.d, pf: t.pf, pa: t.pa, pts: points(t), pct: percentage(t),
    }));
  }

  /* ---- public API ---- */
  const currentYear = new Date().getFullYear();

  async function standings(year = currentYear) {
    try {
      const data = await squiggle(`standings;year=${year}`, { ttl: 60000 });
      const rows = (data.standings || []).map(normStanding).sort((a, b) => a.rank - b.rank);
      if (rows.length) return rows;
      throw new Error("empty");
    } catch (_) {
      return offlineStandings();
    }
  }

  async function games(year = currentYear, { round } = {}) {
    const q = round ? `games;year=${year};round=${round}` : `games;year=${year}`;
    const data = await squiggle(q, { ttl: 20000 });
    return (data.games || []).map(normGame);
  }

  /** Live + today's + most recent round, for the Live view. */
  async function roundSnapshot() {
    const empty = { live: [], recent: [], upcoming: [], round: null, hasLive: false };
    let all = [];
    try { all = await games(currentYear); } catch (_) { return empty; }
    if (!all.length) return empty;
    const maxRound = Math.max(...all.map((g) => g.round || 0));
    // the "current" round = lowest round that still has an incomplete game, else latest
    const incomplete = all.filter((g) => g.status !== "complete").map((g) => g.round);
    const round = incomplete.length ? Math.min(...incomplete) : maxRound;
    const inRound = all.filter((g) => g.round === round);
    const live = inRound.filter((g) => g.status === "live");
    return {
      round,
      live,
      upcoming: inRound.filter((g) => g.status === "upcoming"),
      recent: inRound.filter((g) => g.status === "complete"),
      hasLive: live.length > 0,
    };
  }

  /** Deep historical: full season computed records from that year's games. */
  async function seasonSummary(year) {
    const list = (await games(year)).filter((g) => g.status === "complete");
    if (!list.length) return null;
    let biggestMargin = null, highestScore = null;
    for (const g of list) {
      const margin = Math.abs((g.home.score || 0) - (g.away.score || 0));
      if (!biggestMargin || margin > biggestMargin.margin) biggestMargin = { game: g, margin };
      for (const side of [g.home, g.away]) {
        if (highestScore == null || (side.score || 0) > highestScore.score) {
          highestScore = { team: side.name, score: side.score, game: g };
        }
      }
    }
    return { year, games: list.length, biggestMargin, highestScore };
  }

  /** All-time head-to-head between two teams within a season range. */
  async function headToHead(abbrA, abbrB, fromYear = currentYear, toYear = currentYear) {
    const A = team(abbrA).abbr, B = team(abbrB).abbr;
    const record = { a: A, b: B, aWins: 0, bWins: 0, draws: 0, games: [] };
    for (let y = fromYear; y <= toYear; y++) {
      const list = (await games(y)).filter((g) => g.status === "complete" &&
        [g.home.abbr, g.away.abbr].includes(A) && [g.home.abbr, g.away.abbr].includes(B));
      for (const g of list) {
        const wAbbr = g.winner ? team(g.winner).abbr : null;
        if (!wAbbr) record.draws++;
        else if (wAbbr === A) record.aWins++;
        else record.bWins++;
        record.games.push(g);
      }
    }
    return record;
  }

  function years() {
    const out = [];
    for (let y = currentYear; y >= FIRST_SEASON; y--) out.push(y);
    return out;
  }

  return {
    team, colorOf, standings, games, roundSnapshot, seasonSummary,
    headToHead, years, currentYear,
    get source() { return source; },
  };
})();
