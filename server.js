/*
 * Optional Claude-backed Q&A endpoint.
 *
 * The site works fully offline without this — it's only needed if you want the
 * AI to answer free-form questions the built-in engine can't match. Run it with
 * an Anthropic API key, then point the front-end at it (see README.md).
 *
 *   ANTHROPIC_API_KEY=sk-ant-... node server.js
 *
 * No external npm dependencies: static files + the /api/ask route are served
 * from Node's built-in http module, and Claude is called over fetch.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".ico": "image/x-icon",
};

async function askClaude({ question, season, teams, goalkickers }) {
  if (!API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const system =
    `You are an AFL statistics assistant. Answer ONLY from the supplied ${season} ` +
    `season data. Be concise (1-3 sentences). If the data doesn't cover it, say so. ` +
    `Ladder points = wins*4 + draws*2; percentage = pointsFor/pointsAgainst*100.\n\n` +
    `TEAMS:\n${JSON.stringify(teams)}\n\nGOALKICKERS:\n${JSON.stringify(goalkickers)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content || []).map((b) => b.text || "").join("").trim();
}

const server = http.createServer(async (req, res) => {
  // API route
  if (req.method === "POST" && req.url === "/api/ask") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const answer = await askClaude(JSON.parse(body));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ answer }));
      } catch (e) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Static files
  const safe = path.normalize(req.url === "/" ? "/index.html" : req.url).replace(/^(\.\.[/\\])+/, "");
  const file = path.join(__dirname, safe);
  fs.readFile(file, (err, content) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`AFL stats running at http://localhost:${PORT}`);
  console.log(API_KEY ? `Claude Q&A enabled (${MODEL}).` : "Offline mode (no ANTHROPIC_API_KEY set).");
});
