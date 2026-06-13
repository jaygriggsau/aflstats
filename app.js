/* UI: tab navigation, live/historical rendering, and the chat assistant. */
document.addEventListener("DOMContentLoaded", () => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const dot = (abbr) => `<span class="dot" style="background:${AflData.colorOf(abbr)}"></span>`;

  /* ---- source badge ---- */
  const badge = $("#data-source");
  function refreshBadge() {
    const live = AflData.source === "live";
    badge.textContent = live ? "● LIVE DATA" : "● OFFLINE SNAPSHOT";
    badge.className = "source-badge " + (live ? "is-live" : "is-offline");
    badge.title = live ? "Live data via Squiggle API"
      : "Network unavailable — showing bundled 2024 snapshot";
  }

  /* ---- tab navigation (lazy-loads live/history on first open) ---- */
  const loaded = {};
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.view;
      $$(".tab").forEach((x) => x.classList.toggle("is-active", x === tab));
      $$(".view").forEach((v) => v.classList.toggle("is-active", v.id === `view-${target}`));
      if (target === "live") { startLive(); if (!loaded.live) { loaded.live = true; } }
      else stopLive();
      if (target === "history" && !loaded.history) { loaded.history = true; loadHistory(historyYear.value); }
    });
  });

  /* ================= LADDER ================= */
  const ladderYear = $("#ladder-year");
  function fillYears(sel) {
    sel.innerHTML = AflData.years().map((y) => `<option value="${y}">${y}</option>`).join("");
  }
  fillYears(ladderYear);

  async function renderLadder(year) {
    const rows = await AflData.standings(+year);
    refreshBadge();
    $("#ladder-table tbody").innerHTML = rows.map((t) => `
      <tr class="${t.rank <= 8 ? "finals" : ""}">
        <td>${t.rank}</td>
        <td class="ta-left team-cell">${dot(t.abbr)}${esc(t.name)}</td>
        <td>${t.played}</td><td>${t.w}</td><td>${t.l}</td><td>${t.d}</td>
        <td>${t.pf}</td><td>${t.pa}</td><td>${t.pct.toFixed(1)}</td>
        <td class="strong">${t.pts}</td>
      </tr>`).join("");
    return rows;
  }
  ladderYear.addEventListener("change", () => renderLadder(ladderYear.value));

  /* ================= TEAMS ================= */
  async function renderTeams() {
    const rows = await AflData.standings(AflData.currentYear);
    $("#team-grid").innerHTML = rows.map((t) => `
      <div class="card">
        <div class="card-top">${dot(t.abbr)}<h3>${esc(t.name)}</h3><span class="rank">${t.rank}</span></div>
        <ul class="stat-list">
          <li><span>Record</span><b>${t.w}–${t.l}${t.d ? "–" + t.d : ""}</b></li>
          <li><span>Points</span><b>${t.pts}</b></li>
          <li><span>Percentage</span><b>${t.pct.toFixed(1)}%</b></li>
          <li><span>For / Against</span><b>${t.pf} / ${t.pa}</b></li>
        </ul>
      </div>`).join("");
  }

  /* ================= PLAYERS (offline goalkickers) ================= */
  $("#players-table tbody").innerHTML = GOALKICKERS.map((g, i) =>
    `<tr><td>${i + 1}</td><td class="ta-left">${esc(g.player)}</td>
      <td class="ta-left">${esc(g.team)}</td><td class="strong">${g.goals}</td></tr>`).join("");

  /* ================= LIVE ================= */
  let liveTimer = null;
  const liveDot = $(".live-dot");
  const fmtDate = (d) => { try { return new Date(d.replace(" ", "T")).toLocaleString("en-AU",
    { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return d || ""; } };

  function gameCard(g) {
    const pill = g.status === "live" ? `<span class="pill live">● ${esc(g.timestr || "LIVE")}</span>`
      : g.status === "complete" ? `<span class="pill done">FINAL</span>`
      : `<span class="pill soon">${esc(fmtDate(g.date))}</span>`;
    const side = (s, win) => `
      <div class="g-side ${win ? "win" : ""}">
        ${dot(s.abbr)}<span class="g-name">${esc(s.name)}</span>
        <span class="g-score">${s.score == null ? "–" : s.score}</span>
      </div>`;
    const hWin = g.winner && g.winner === g.home.name;
    const aWin = g.winner && g.winner === g.away.name;
    const bar = g.status === "live"
      ? `<div class="prog"><i style="width:${g.complete}%"></i></div>` : "";
    return `<div class="game ${g.status}">
      <div class="g-head">${pill}<span class="g-venue">${esc(g.venue || "")}</span></div>
      ${side(g.home, hWin)}${side(g.away, aWin)}${bar}</div>`;
  }

  async function renderLive() {
    const board = $("#live-board");
    try {
      const snap = await AflData.roundSnapshot();
      refreshBadge();
      if (AflData.source !== "live") {
        board.innerHTML = `<div class="empty">No live connection. Live scores appear when the
          Squiggle API is reachable (run locally, or allowlist <code>api.squiggle.com.au</code>).</div>`;
        liveDot.hidden = true;
        $("#live-round").textContent = "";
        return;
      }
      $("#live-round").textContent = snap.round ? `Round ${snap.round}` : "";
      liveDot.hidden = !snap.hasLive;
      const group = (title, list, cls = "") => list.length
        ? `<h3 class="sub ${cls}">${title}</h3><div class="game-grid">${list.map(gameCard).join("")}</div>` : "";
      board.innerHTML =
        group("● Live Now", snap.live, "live-h") +
        group("Upcoming", snap.upcoming) +
        group("Latest Results", snap.recent) ||
        `<div class="empty">No games scheduled for the current round.</div>`;
    } catch (e) {
      board.innerHTML = `<div class="empty">Couldn't load live data right now.</div>`;
    }
  }

  function startLive() {
    renderLive();
    if (liveTimer) return;
    if ($("#live-auto").checked) liveTimer = setInterval(renderLive, 30000);
  }
  function stopLive() { if (liveTimer) { clearInterval(liveTimer); liveTimer = null; } }
  $("#live-refresh").addEventListener("click", renderLive);
  $("#live-auto").addEventListener("change", (e) => {
    stopLive();
    if (e.target.checked) liveTimer = setInterval(renderLive, 30000);
  });

  /* ================= HISTORY ================= */
  const historyYear = $("#history-year");
  fillYears(historyYear);

  async function loadHistory(year) {
    const sumEl = $("#history-summary");
    sumEl.innerHTML = `<p class="muted">Loading ${year}…</p>`;
    // ladder
    const rows = await AflData.standings(+year);
    refreshBadge();
    $("#history-ladder tbody").innerHTML = rows.map((t) => `
      <tr class="${t.rank <= 8 ? "finals" : ""}"><td>${t.rank}</td>
        <td class="ta-left team-cell">${dot(t.abbr)}${esc(t.name)}</td>
        <td>${t.played}</td><td>${t.w}</td><td>${t.l}</td><td>${t.d}</td>
        <td>${t.pf}</td><td>${t.pa}</td><td>${t.pct.toFixed(1)}</td>
        <td class="strong">${t.pts}</td></tr>`).join("");

    // results + records (only when we have live game data)
    const resultsEl = $("#history-results");
    if (AflData.source !== "live") {
      sumEl.innerHTML = `<div class="empty">Season records and results need the live API.
        Showing the bundled 2024 ladder as a fallback.</div>`;
      resultsEl.innerHTML = "";
      return;
    }
    try {
      const [games, summary] = await Promise.all([
        AflData.games(+year), AflData.seasonSummary(+year),
      ]);
      if (summary) {
        const bm = summary.biggestMargin, hs = summary.highestScore;
        sumEl.innerHTML = `
          <div class="sumcard"><span>Games played</span><b>${summary.games}</b></div>
          <div class="sumcard"><span>Biggest margin</span><b>${bm.margin}</b>
            <small>${esc(bm.game.winner || "")} v ${esc((bm.game.winner === bm.game.home.name ? bm.game.away : bm.game.home).name)}</small></div>
          <div class="sumcard"><span>Highest score</span><b>${hs.score}</b>
            <small>${esc(hs.team)} (R${hs.game.round})</small></div>`;
      } else sumEl.innerHTML = "";
      const done = games.filter((g) => g.status === "complete");
      resultsEl.innerHTML = done.map((g) => `
        <div class="result-row">
          <span class="r-round">R${g.round}</span>
          <span class="r-team ${g.winner === g.home.name ? "win" : ""}">${dot(g.home.abbr)}${esc(g.home.name)}</span>
          <span class="r-score">${g.home.score} – ${g.away.score}</span>
          <span class="r-team ${g.winner === g.away.name ? "win" : ""}">${esc(g.away.name)}${dot(g.away.abbr)}</span>
        </div>`).join("") || `<p class="muted">No results recorded.</p>`;
    } catch (e) {
      resultsEl.innerHTML = `<p class="muted">Couldn't load ${year} results.</p>`;
    }
  }
  historyYear.addEventListener("change", () => loadHistory(historyYear.value));

  /* ================= CHAT ================= */
  const chat = $("#chat");
  function bubble(text, who) {
    const el = document.createElement("div");
    el.className = `bubble ${who}`;
    el.innerHTML = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    return el;
  }
  async function handleQuestion(q) {
    bubble(esc(q), "user");
    const thinking = bubble("<span class='typing'><i></i><i></i><i></i></span>", "ai");
    try { thinking.innerHTML = await AflAI.ask(q); }
    catch { thinking.innerHTML = "Something went wrong answering that — try rephrasing."; }
    chat.scrollTop = chat.scrollHeight;
  }
  $("#ask-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#ask-input").value.trim();
    if (!q) return;
    $("#ask-input").value = "";
    handleQuestion(q);
  });
  $$(".chip").forEach((c) => c.addEventListener("click", () => handleQuestion(c.textContent.trim())));
  bubble(`G'day! I'm your AFL stats assistant. I can answer questions about the ladder, team ` +
    `records, percentages, goalkickers and live or historical results. Tap a suggestion to start.`, "ai");

  /* ================= INITIAL LOAD ================= */
  (async () => {
    await renderLadder(ladderYear.value); // also sets the source badge
    refreshBadge();
    renderTeams();
  })();
});
