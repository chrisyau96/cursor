# Momentum · Habit Tracker

A sophisticated, mobile-first **habit tracking web app**. Build daily habits, store your
records locally, and review your trends and results across weekly, monthly, and yearly
views. It works fully offline in the browser (no account, no server) and is designed for
phone use, with a phone-style frame when opened on a larger screen.

The content and philosophy are based on a **Self-Discipline Operating System** guide, which
is built into the in-app Guide tab.

## Features

- **Today** — a week strip, an animated progress ring, and one-tap check-off for each
  habit. Yes/No habits and measurable "count" habits (e.g. drink 8 cups of water) are both
  supported, with per-habit streaks (🔥) shown inline.
- **Daily memo** — capture a mood (😞–😄) and a short reflection for any day.
- **Calendar** — a monthly grid with a completion heatmap for *all habits* or a single
  selected habit, plus month stats (completion %, streaks, perfect days). Tap any past day
  to jump back and edit its records.
- **Reports** — trends across three ranges:
  - **Weekly**: daily completion bar chart, best day, perfect days.
  - **Monthly**: 30-day completion line chart and week-over-week comparison.
  - **Yearly**: a GitHub-style activity heatmap and monthly completion bars.
  - A per-habit breakdown with completion rate and current streak.
- **Guide** — the Self-Discipline OS content (four levers, weekday rhythm, low-energy
  protocol, curated resources), habit management (reorder / edit / add), dark mode, and
  data backup.
- **Records storage** — everything is persisted to `localStorage`. Export/import a JSON
  backup, or reset to defaults, from the Guide tab.

## Data model

Data is stored under the `momentum.habits.v1` key in `localStorage`:

- `habits[]` — `{ id, name, icon, color, type: "check" | "count", target, unit, freq, category }`
- `records[dateISO][habitId]` — a number (1 for a completed check, or the count value)
- `notes[dateISO]` — `{ text, mood }`

First-run users are seeded with a set of default habits and ~5 weeks of sample history so
the reports and calendar are immediately meaningful. Use **Guide → Reset all data** to
start fresh.

## Run locally

It is a static site with ES modules, so it must be served over HTTP (opening the file
directly with `file://` will not load the modules).

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000 on your phone or browser
```

Any static file server works (`npx serve`, `http-server`, etc.).

## Project structure

```
index.html                 # app shell (top bar, view host, tab bar)
assets/css/styles.css      # design system + all component styles
assets/js/
  app.js                   # router, sheet/toast host, view rendering
  store.js                 # state, localStorage, streak & stat logic
  utils.js                 # DOM + date helpers
  charts.js                # dependency-free SVG/DOM charts
  habitForm.js             # create / edit / delete habit sheet
  views/
    today.js               # Today view
    calendar.js            # Calendar view
    reports.js             # Reports view
    guide.js               # Guide + management + settings
    sheets.js              # habit detail + daily memo sheets
```

No build step and no external dependencies.
