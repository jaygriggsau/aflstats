/*
 * Offline natural-language Q&A engine for the AFL stats dataset.
 *
 * It works without any network access: questions are normalised, matched
 * against a set of intents, and answered by computing over TEAMS/GOALKICKERS.
 *
 * Optional: if window.AFL_AI_CONFIG.endpoint is set (see README.md), unmatched
 * questions are forwarded to a Claude-backed endpoint instead of the fallback.
 */
const AflAI = (() => {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9%\s]/g, " ").replace(/\s+/g, " ").trim();
  const fmtPct = (t) => percentage(t).toFixed(1);
  const ord = (n) => { const s = ["th","st","nd","rd"], v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); };

  /** Resolve a team mentioned anywhere in the text (name, nickname or abbr). */
  const NICKNAMES = {
    swans: "SYD", power: "PA", cats: "GEE", lions: "BL", giants: "GWS",
    bulldogs: "WB", doggies: "WB", hawks: "HAW", blues: "CAR", dockers: "FRE",
    freo: "FRE", magpies: "COL", pies: "COL", suns: "GC", crows: "ADE",
    bombers: "ESS", dons: "ESS", saints: "STK", demons: "MEL", dees: "MEL",
    tigers: "RIC", eagles: "WCE", kangaroos: "NM", roos: "NM", "north": "NM",
  };
  function findTeams(text) {
    const found = new Map();
    for (const t of TEAMS) {
      // whole-word keywords: full name, abbr, and the distinctive city/first word
      const first = norm(t.name).split(" ")[0];
      const words = new Set([norm(t.name), norm(t.abbr), first]);
      for (const w of words) {
        if (new RegExp(`\\b${w}\\b`).test(text)) { found.set(t.abbr, t); break; }
      }
    }
    for (const [nick, abbr] of Object.entries(NICKNAMES)) {
      if (new RegExp(`\\b${nick}\\b`).test(text)) {
        found.set(abbr, TEAMS.find((t) => t.abbr === abbr));
      }
    }
    return [...found.values()];
  }
  const has = (text, ...words) => words.some((w) => text.includes(w));
  const isCompare = (t) => /\b(vs|versus|compare|compared|against|or)\b/.test(t);
  /** Most specifically-matched team: prefer a full-name hit, else the first. */
  function primaryTeam(text) {
    const teams = findTeams(text);
    return teams.find((x) => text.includes(norm(x.name))) || teams[0];
  }

  /* ---- intents, evaluated in order; first match wins ---- */
  const intents = [
    // Premiership
    {
      test: (t) => has(t, "premier", "premiership", "flag", "grand final", "win the grand", "won the 2024", "champion"),
      answer: () => `<b>${PREMIER}</b> won the ${AFL_SEASON} premiership, defeating the Sydney Swans in the Grand Final.`,
    },
    // Top of the ladder / minor premiers
    {
      test: (t) => (has(t, "top of the ladder", "minor premier", "first on the ladder", "lead the ladder", "led the ladder") ||
                    (has(t, "ladder") && has(t, "top", "lead", "first", "1st"))),
      answer: () => {
        const top = ladder()[0];
        return `<b>${top.name}</b> finished on top of the ${AFL_SEASON} home-and-away ladder ` +
               `with ${points(top)} points (${top.w}–${top.l}${top.d ? "–" + top.d : ""}, ${fmtPct(top)}%).`;
      },
    },
    // Most wins
    {
      test: (t) => has(t, "most wins", "most games", "won the most", "win the most", "most victories"),
      answer: () => {
        const top = [...TEAMS].sort((a, b) => b.w - a.w)[0];
        const tied = TEAMS.filter((x) => x.w === top.w);
        const who = tied.length > 1
          ? tied.map((x) => `<b>${x.name}</b>`).join(" and ")
          : `<b>${top.name}</b>`;
        return `${who} won the most games in ${AFL_SEASON} with <b>${top.w}</b> wins.`;
      },
    },
    // Best / worst percentage
    {
      test: (t) => has(t, "percentage", "percent", "%") && has(t, "best", "highest", "top", "most"),
      answer: () => {
        const top = [...TEAMS].sort((a, b) => percentage(b) - percentage(a))[0];
        return `<b>${top.name}</b> had the best percentage at <b>${fmtPct(top)}%</b> (${top.pf} for, ${top.pa} against).`;
      },
    },
    {
      test: (t) => has(t, "percentage", "percent", "%") && has(t, "worst", "lowest", "bottom"),
      answer: () => {
        const low = [...TEAMS].sort((a, b) => percentage(a) - percentage(b))[0];
        return `<b>${low.name}</b> had the lowest percentage at <b>${fmtPct(low)}%</b>.`;
      },
    },
    // Highest / lowest scoring (points for)
    {
      test: (t) => has(t, "score", "scoring", "points for", "most points", "highest scoring", "offence", "offense"),
      answer: () => {
        const top = [...TEAMS].sort((a, b) => b.pf - a.pf)[0];
        return `<b>${top.name}</b> were the highest-scoring team, kicking <b>${top.pf}</b> points across the season ` +
               `(${(top.pf / gamesPlayed(top)).toFixed(1)} per game).`;
      },
    },
    // Best defence (fewest against)
    {
      test: (t) => has(t, "best defence", "best defense", "fewest points", "least points", "stingiest", "conceded the fewest", "best defensive"),
      answer: () => {
        const top = [...TEAMS].sort((a, b) => a.pa - b.pa)[0];
        return `<b>${top.name}</b> had the best defence, conceding only <b>${top.pa}</b> points all season.`;
      },
    },
    // Wooden spoon / bottom
    {
      test: (t) => has(t, "wooden spoon", "last", "bottom", "worst team", "finished last"),
      answer: () => {
        const last = ladder()[ladder().length - 1];
        return `<b>${last.name}</b> finished last (the wooden spoon) with ${last.w} wins and ${points(last)} points.`;
      },
    },
    // Top goalkicker
    {
      test: (t) => has(t, "goalkicker", "goal kicker", "coleman", "most goals", "top goal", "leading goal", "kicked the most"),
      answer: (t) => {
        // team-specific goalkicker?
        const teams = findTeams(t);
        if (teams.length === 1) {
          const list = GOALKICKERS.filter((g) => g.team === teams[0].name);
          if (list.length) {
            const top = list[0];
            return `For <b>${teams[0].name}</b>, the leading goalkicker in the dataset is ` +
                   `<b>${top.player}</b> with <b>${top.goals}</b> goals.`;
          }
        }
        const top = GOALKICKERS[0];
        return `<b>${top.player}</b> (${top.team}) led the goalkicking with <b>${top.goals}</b> goals in ${AFL_SEASON}.`;
      },
    },
    // Head-to-head comparison (two teams)
    {
      test: (t) => findTeams(t).length >= 2 && isCompare(t),
      answer: (t) => {
        const [a, b] = findTeams(t);
        const row = (x) => `<b>${x.name}</b>: ${x.w}–${x.l}${x.d ? "–" + x.d : ""}, ` +
          `${points(x)} pts, ${fmtPct(x)}% (rank ${ord(ladder().indexOf(ladder().find(l => l.abbr === x.abbr)) + 1)})`;
        const better = points(a) !== points(b)
          ? (points(a) > points(b) ? a : b)
          : (percentage(a) > percentage(b) ? a : b);
        return `${row(a)}<br>${row(b)}<br><br><b>${better.name}</b> finished higher on the ladder.`;
      },
    },
    // Single-team summary
    {
      test: (t) => findTeams(t).length >= 1,
      answer: (t) => {
        const x = primaryTeam(t);
        const rank = ladder().findIndex((l) => l.abbr === x.abbr) + 1;
        return `<b>${x.name}</b> finished <b>${ord(rank)}</b> in ${AFL_SEASON}: ` +
               `${x.w} wins, ${x.l} losses${x.d ? `, ${x.d} draw${x.d > 1 ? "s" : ""}` : ""}, ` +
               `${points(x)} premiership points and a percentage of ${fmtPct(x)}% ` +
               `(${x.pf} for, ${x.pa} against).`;
      },
    },
    // How many teams
    {
      test: (t) => has(t, "how many teams", "number of teams"),
      answer: () => `There are <b>${TEAMS.length}</b> teams in the competition.`,
    },
    // Help
    {
      test: (t) => has(t, "help", "what can you", "examples"),
      answer: () => `Ask me things like: <i>“Who finished top of the ladder?”</i>, ` +
        `<i>“Best percentage?”</i>, <i>“Top goalkicker?”</i>, <i>“How did Carlton go?”</i> ` +
        `or compare two teams like <i>“Brisbane vs Sydney”</i>.`,
    },
  ];

  /* ---- live/historical handlers backed by AflData (async) ---- */
  async function dynamicAnswer(question, t) {
    if (typeof AflData === "undefined") return null;

    // Live current-round scores
    if (has(t, "live", "score now", "playing now", "current game", "current score",
            "who is winning", "whos winning", "today", "scores")) {
      try {
        const snap = await AflData.roundSnapshot();
        if (AflData.source !== "live") return null; // let offline intents answer
        if (snap.live.length) {
          return "Live now: " + snap.live.map((g) =>
            `<b>${g.home.name}</b> ${g.home.score}–${g.away.score} <b>${g.away.name}</b> (${g.timestr || "live"})`
          ).join("<br>");
        }
        if (snap.recent.length) {
          return `No games are live right now. Latest results (Round ${snap.round}):<br>` +
            snap.recent.map((g) => `${g.home.name} ${g.home.score}–${g.away.score} ${g.away.name}`).join("<br>");
        }
        if (snap.upcoming.length) {
          return `Nothing live. Next up (Round ${snap.round}): ` +
            snap.upcoming.map((g) => `${g.home.name} v ${g.away.name}`).join(", ") + ".";
        }
      } catch (_) { /* fall through */ }
    }

    // Current-season ladder questions — prefer LIVE standings when reachable
    const ladderQ = has(t, "ladder", "top", "lead", "first", "minor premier", "most wins",
                        "most games", "best percentage", "wooden spoon", "last", "bottom");
    if (ladderQ && !/\b((?:18|19|20)\d\d)\b/.test(t)) {
      try {
        const rows = await AflData.standings();
        if (AflData.source === "live") {
          if (has(t, "wooden spoon", "last", "bottom")) {
            const x = rows[rows.length - 1];
            return `<b>${x.name}</b> are currently last with ${x.w} wins and ${x.pts} points.`;
          }
          if (has(t, "most wins", "most games")) {
            const x = [...rows].sort((a, b) => b.w - a.w)[0];
            return `<b>${x.name}</b> have the most wins so far this season with <b>${x.w}</b>.`;
          }
          if (has(t, "percentage")) {
            const x = [...rows].sort((a, b) => b.pct - a.pct)[0];
            return `<b>${x.name}</b> have the best percentage at <b>${x.pct.toFixed(1)}%</b>.`;
          }
          const top = rows[0];
          return `<b>${top.name}</b> currently lead the ladder — ${top.pts} pts, ` +
            `${top.w}–${top.l}${top.d ? "–" + top.d : ""}, ${top.pct.toFixed(1)}% (live).`;
        }
      } catch (_) { /* fall through to offline snapshot */ }
    }

    // Year-specific historical ladder / premier / "who finished top in 2010"
    const ym = /\b((?:18|19|20)\d\d)\b/.exec(t);
    if (ym && has(t, "ladder", "top", "won", "win", "premier", "finished", "first", "minor", "standings", "champion")) {
      const year = +ym[1];
      try {
        const rows = await AflData.standings(year);
        if (AflData.source !== "live" && year !== +AFL_SEASON) {
          return `Historical data for <b>${year}</b> needs the live API, which isn't reachable ` +
            `right now. Only the bundled ${AFL_SEASON} snapshot is available offline.`;
        }
        const top = rows[0];
        if (has(t, "premier", "champion", "flag", "won the")) {
          return `The minor premiers (ladder leaders) in <b>${year}</b> were <b>${top.name}</b> ` +
            `with ${top.pts} points. (Premiership is decided in the finals.)`;
        }
        return `Top of the <b>${year}</b> ladder: <b>${top.name}</b> — ${top.pts} pts, ` +
          `${top.w}–${top.l}${top.d ? "–" + top.d : ""}, ${top.pct.toFixed(1)}%.`;
      } catch (_) { /* fall through */ }
    }
    return null;
  }

  /** Main entry: returns a Promise<string> (HTML). */
  async function ask(question) {
    const t = norm(question);
    if (!t) return "Ask me a question about the AFL season.";

    const dyn = await dynamicAnswer(question, t);
    if (dyn) return dyn;

    for (const intent of intents) {
      if (intent.test(t)) return intent.answer(t);
    }

    // Optional remote (Claude) fallback for anything we can't match locally.
    const cfg = window.AFL_AI_CONFIG;
    if (cfg && cfg.endpoint) {
      try {
        const res = await fetch(cfg.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, season: AFL_SEASON, teams: TEAMS, goalkickers: GOALKICKERS }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.answer) return data.answer;
        }
      } catch (_) { /* fall through to local message */ }
    }

    return `I couldn't find that in the ${AFL_SEASON} dataset. ` +
           `Try asking about the ladder, wins, percentage, scoring or goalkickers — or type <i>help</i>.`;
  }

  return { ask };
})();
