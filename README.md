# AFL Stats · Ask the AI

A single-page AFL statistics site for the **2024 season** with a built-in AI
assistant that answers questions in plain English.

![Tabs: Ask the AI · Ladder · Teams · Players](https://img.shields.io/badge/views-AI%20%C2%B7%20Ladder%20%C2%B7%20Teams%20%C2%B7%20Players-e4002b)

## Features

- **Ask the AI** — natural-language Q&A over live, historical and bundled data
  (ladder, records, percentages, scoring, live scores, head-to-heads, goalkickers).
- **Live** — current-round match scores with quarter/time, progress bars and
  auto-refresh (every 30s); upcoming fixtures and latest results.
- **Ladder** — live ladder for any season, W/L/D, for/against, %, points.
- **History** — deep per-season data back to **1897**: final ladder, every
  result, and computed season records (biggest margin, highest score).
- **Teams** — per-team stat cards.
- **Players** — leading goalkickers.

### Live & historical data (Squiggle)

Live scores and historical results come from the free community
[**Squiggle API**](https://api.squiggle.com.au). Requests are proxied through
this app's `/api/afl` endpoint (`server.js`) so the required `User-Agent` is
sent and responses are cached (short TTL for live data, long for past seasons).

A request only reaches Squiggle when the host is reachable. In a restricted
environment (e.g. Claude Code on the web with allowlist egress) add
`api.squiggle.com.au` to the network egress settings —
see the [network docs](https://code.claude.com/docs/en/claude-code-on-the-web).

> **Note on "live stats":** Squiggle provides live *scores*, match progress and
> win-probability — not player-level live stats (disposals, tackles), which no
> free public AFL source exposes. Historical depth is team/match level.

### Offline fallback

Everything **degrades gracefully**. When the API can't be reached, the app falls
back to the bundled 2024 snapshot in `data.js`, the AI answers from it, and a
badge in the header shows **OFFLINE SNAPSHOT** vs **LIVE DATA** so it's always
clear which you're seeing. Ladder points and percentages are computed at
runtime, so displayed stats never contradict each other.

The AI assistant (`ai.js`) needs **no API key**: it answers live/historical
questions via the data layer and falls back to local parsing of the bundled
dataset.

### Example questions

- "Who finished top of the ladder?"
- "Who won the most games?"
- "Best percentage?" / "Best defence?"
- "Highest scoring team?"
- "Top goalkicker?" / "Carlton's leading goalkicker?"
- "How did Fremantle go?"
- "Brisbane vs Sydney"
- "Who won the premiership?"
- "Live scores" / "Who is winning?"  *(live data)*
- "Who finished top in 2010?"  *(historical)*

## Run it

For **live data**, run the bundled Node server (Node 18+, no npm dependencies):

```bash
node server.js                 # http://localhost:3000
```

This serves the site **and** proxies live/historical data from Squiggle.

Without a server it still runs as a static page (offline snapshot only) — open
`index.html` directly, or `python3 -m http.server 8000`. Live and history views
need the proxy, so use `node server.js` for the full experience.

## Deploy to Vercel

The repo is Vercel-ready as a **static site + serverless functions** (no build
step). The pages are served statically and the data proxy runs as functions:

| Route | File | Purpose |
|-------|------|---------|
| `/api/afl` | `api/afl.js` | Squiggle proxy (live + historical) |
| `/api/ask` | `api/ask.js` | Optional Claude answers |

`vercel.json` pins the project to no framework / no build with `outputDirectory: "."`,
so Vercel serves the static files and only invokes a function for `/api/*`.

Just import the repo into Vercel and deploy — live data works out of the box
(Vercel functions have outbound internet). For the optional Claude fallback,
add `ANTHROPIC_API_KEY` in the Vercel project's Environment Variables and set
`window.AFL_AI_CONFIG = { endpoint: "/api/ask" }` in `index.html`.

> If you previously deployed and saw `FUNCTION_INVOCATION_FAILED`, it was because
> `server.js` (a long-running Node server) can't run as a Vercel function. The
> `api/` functions above are the Vercel-native equivalents; `server.js` remains
> for local use.

## Optional: Claude-backed answers

To let the AI handle free-form questions the built-in engine can't match,
run the bundled Node server (no npm dependencies) and point the front-end at
its `/api/ask` route.

```bash
ANTHROPIC_API_KEY=sk-ant-... node server.js   # http://localhost:3000
```

Then enable the fallback by adding this to `index.html` before `ai.js`:

```html
<script>window.AFL_AI_CONFIG = { endpoint: "/api/ask" };</script>
```

The server sends only the season dataset and the user's question to Claude
(default model `claude-sonnet-4-6`) and instructs it to answer strictly from
that data.

## Data note

The dataset is **illustrative**: win/loss records and ladder order approximate
the real 2024 home-and-away season (Sydney minor premiers; Brisbane Lions
premiers), while points-for/against are representative figures chosen for
internal consistency. Update `data.js` with official figures to make it exact.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure & tabs |
| `styles.css` | Styling |
| `afl-data.js` | Data layer: live Squiggle fetch + cache + offline fallback |
| `data.js` | Bundled offline 2024 snapshot + derived-stat helpers |
| `ai.js` | NL question-answering engine (live, historical & offline) |
| `app.js` | Rendering (Live / Ladder / History / Teams / Players) & chat UI |
| `server.js` | Static server + Squiggle proxy (`/api/afl`) + optional Claude (`/api/ask`) |
