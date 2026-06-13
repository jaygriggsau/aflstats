/*
 * Vercel serverless function: GET /api/afl?q=standings;year=2024
 * Proxies the free Squiggle AFL API (live + historical) with the required
 * User-Agent and CDN caching. Mirrors the /api/afl route in server.js so the
 * same front-end works locally (node server.js) and on Vercel.
 */
const SQUIGGLE_BASE = "https://api.squiggle.com.au/";
const UA = process.env.SQUIGGLE_UA || "aflstats-demo/1.0 (+https://github.com/jaygriggsau/aflstats)";
const ALLOWED_Q = new Set(["games", "standings", "teams", "tips", "ladder"]);

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  try {
    const q = new URL(req.url, "http://localhost").searchParams.get("q") || "";
    const kind = q.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_Q.has(kind)) return json(400, { error: `query "${kind}" not allowed` });

    const r = await fetch(`${SQUIGGLE_BASE}?q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    const body = await r.text();
    if (!r.ok) return json(502, { error: `Squiggle ${r.status}` });

    // Cache at the edge: long for past seasons, short for live data.
    const past = /year=(\d{4})/.exec(q);
    const isHistory = past && +past[1] < new Date().getFullYear();
    res.writeHead(200, {
      "content-type": "application/json",
      "cache-control": isHistory ? "s-maxage=86400, stale-while-revalidate=86400"
                                 : "s-maxage=15, stale-while-revalidate=30",
    });
    res.end(body);
  } catch (e) {
    json(502, { error: e.message });
  }
};
