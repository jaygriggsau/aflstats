/* UI: tab switching, table/card rendering, and the chat interaction. */
const TEAM_COLORS = {
  SYD: "#e1242a", PA: "#01b5b5", GEE: "#1f3c70", BL: "#7a0026", GWS: "#f47920",
  WB: "#0039a6", HAW: "#4d2004", CAR: "#031a3a", FRE: "#2e1a47", COL: "#111111",
  GC: "#d11a2a", ADE: "#002b5c", ESS: "#cc2031", STK: "#ed1b2f", MEL: "#0f1131",
  RIC: "#f2c200", WCE: "#003087", NM: "#1a3a8f",
};

document.addEventListener("DOMContentLoaded", () => {
  /* ---- tab navigation ---- */
  const tabs = document.querySelectorAll(".tab");
  const views = document.querySelectorAll(".view");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.view;
      tabs.forEach((x) => x.classList.toggle("is-active", x === tab));
      views.forEach((v) => v.classList.toggle("is-active", v.id === `view-${target}`));
    });
  });

  /* ---- ladder ---- */
  const ladderBody = document.querySelector("#ladder-table tbody");
  ladder().forEach((t, i) => {
    const tr = document.createElement("tr");
    if (i < 8) tr.classList.add("finals");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="ta-left team-cell"><span class="dot" data-abbr="${t.abbr}"></span>${t.name}</td>
      <td>${gamesPlayed(t)}</td><td>${t.w}</td><td>${t.l}</td><td>${t.d}</td>
      <td>${t.pf}</td><td>${t.pa}</td><td>${percentage(t).toFixed(1)}</td>
      <td class="strong">${points(t)}</td>`;
    ladderBody.appendChild(tr);
  });

  /* ---- team cards ---- */
  const grid = document.querySelector("#team-grid");
  ladder().forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-top">
        <span class="dot" data-abbr="${t.abbr}"></span>
        <h3>${t.name}</h3>
        <span class="rank">${i + 1}</span>
      </div>
      <ul class="stat-list">
        <li><span>Record</span><b>${t.w}–${t.l}${t.d ? "–" + t.d : ""}</b></li>
        <li><span>Points</span><b>${points(t)}</b></li>
        <li><span>Percentage</span><b>${percentage(t).toFixed(1)}%</b></li>
        <li><span>For / Against</span><b>${t.pf} / ${t.pa}</b></li>
      </ul>`;
    grid.appendChild(card);
  });

  /* ---- players ---- */
  const playersBody = document.querySelector("#players-table tbody");
  GOALKICKERS.forEach((g, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i + 1}</td><td class="ta-left">${g.player}</td>
      <td class="ta-left">${g.team}</td><td class="strong">${g.goals}</td>`;
    playersBody.appendChild(tr);
  });

  /* ---- chat ---- */
  const chat = document.querySelector("#chat");
  const form = document.querySelector("#ask-form");
  const input = document.querySelector("#ask-input");

  function bubble(text, who) {
    const el = document.createElement("div");
    el.className = `bubble ${who}`;
    el.innerHTML = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    return el;
  }

  async function handleQuestion(q) {
    bubble(q.replace(/</g, "&lt;"), "user");
    const thinking = bubble("<span class='typing'><i></i><i></i><i></i></span>", "ai");
    try {
      const answer = await AflAI.ask(q);
      thinking.innerHTML = answer;
    } catch (e) {
      thinking.innerHTML = "Something went wrong answering that — try rephrasing.";
    }
    chat.scrollTop = chat.scrollHeight;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    handleQuestion(q);
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => handleQuestion(chip.textContent.trim()));
  });

  // Colour the team dots
  document.querySelectorAll(".dot[data-abbr]").forEach((d) => {
    const c = TEAM_COLORS[d.dataset.abbr];
    if (c) d.style.background = c;
  });

  // Greeting
  bubble(`G'day! I'm your AFL ${AFL_SEASON} stats assistant. Ask me about the ladder, ` +
    `team records, percentages or goalkickers. Tap a suggestion below to get started.`, "ai");
});
