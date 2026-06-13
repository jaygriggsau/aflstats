/*
 * Vercel serverless function: POST /api/ask
 * Optional Claude-backed free-form answers (enabled only if ANTHROPIC_API_KEY
 * is set in the Vercel project env). Mirrors the /api/ask route in server.js.
 * The site works without this — the built-in engine answers offline.
 */
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  if (req.method !== "POST") return json(405, { error: "POST only" });
  if (!API_KEY) return json(501, { error: "ANTHROPIC_API_KEY not configured" });

  try {
    const { question, season, teams, goalkickers } = await readBody(req);
    const system =
      `You are an AFL statistics assistant. Answer ONLY from the supplied ${season} ` +
      `season data. Be concise (1-3 sentences). If the data doesn't cover it, say so. ` +
      `Ladder points = wins*4 + draws*2; percentage = pointsFor/pointsAgainst*100.\n\n` +
      `TEAMS:\n${JSON.stringify(teams)}\n\nGOALKICKERS:\n${JSON.stringify(goalkickers)}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 400, system,
        messages: [{ role: "user", content: String(question || "") }],
      }),
    });
    if (!r.ok) return json(502, { error: `Anthropic ${r.status}` });
    const data = await r.json();
    const answer = (data.content || []).map((b) => b.text || "").join("").trim();
    json(200, { answer });
  } catch (e) {
    json(500, { error: e.message });
  }
};
