# AFL Stats · Ask the AI

A single-page AFL statistics site for the **2024 season** with a built-in AI
assistant that answers questions in plain English.

![Tabs: Ask the AI · Ladder · Teams · Players](https://img.shields.io/badge/views-AI%20%C2%B7%20Ladder%20%C2%B7%20Teams%20%C2%B7%20Players-e4002b)

## Features

- **Ask the AI** — natural-language Q&A over the season data
  (ladder, records, percentages, scoring, head-to-heads, goalkickers).
- **Ladder** — full home-and-away ladder with W/L/D, for/against, %, points.
- **Teams** — per-team stat cards.
- **Players** — leading goalkickers.

The AI works **fully offline** — no API key required. Questions are parsed and
answered locally by `ai.js` over the dataset in `data.js`. Ladder points and
percentages are computed at runtime, so the displayed stats can never
contradict each other.

### Example questions

- "Who finished top of the ladder?"
- "Who won the most games?"
- "Best percentage?" / "Best defence?"
- "Highest scoring team?"
- "Top goalkicker?" / "Carlton's leading goalkicker?"
- "How did Fremantle go?"
- "Brisbane vs Sydney"
- "Who won the premiership?"

## Run it

It's static — open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

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
| `data.js` | Season dataset + derived-stat helpers |
| `ai.js` | Offline NL question-answering engine |
| `app.js` | Rendering & chat UI |
| `server.js` | Optional Claude proxy + static server |
