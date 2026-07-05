# Momentum · Habit Tracker

A sophisticated, mobile-first **habit tracking web app**. Build daily habits, store your
records locally, and review your trends and results across weekly, monthly, and yearly
views. It works fully offline in the browser (no account, no server) and is designed for
phone use, with a phone-style frame when opened on a larger screen.

The content and philosophy are based on a **Self-Discipline Operating System** guide, which
is built into the in-app Guide tab.

## Features

- **Today** — a live date + clock, a week strip, an animated progress ring, and one-tap
  check-off for each habit. Yes/No habits and measurable "count" habits (e.g. drink 8 cups
  of water) are both supported, with per-habit streaks (🔥) shown inline. Each save records
  the entry time. A gamification strip shows your level/identity, credits, and 100% streak.
- **Journal** — write a reflection directly on Today, with a mood (😞–😄) and a 0–10 day
  score. Entries are timestamped and can be edited or removed. Mood and score feed the
  calendar and reports.
- **Calendar** — dynamic **Month** and **Quarter** views with swipe + arrow + year
  navigation. Colour the heatmap by **Completion**, **Mood**, or **Score** for all habits,
  or view a single habit's completion. Month/quarter stats include completion %, streaks,
  perfect days, average mood and average score. Tap any past day to jump back and edit it.
- **Reports** — trends across Weekly / Monthly / Yearly, including a **Longest 100% streak**
  stat, a GitHub-style yearly activity heatmap, a merged **mood & score** journal trend, and
  a per-habit breakdown.
- **Rewards (gamification)** — earn credits and XP from your consistency:
  - **HK$10** for a 100% day, **HK$2** for a 50–99% day.
  - **XP** per habit done (+bonus for perfect days) drives a **Level → Identity** progression
    (e.g. *The Beginner → The Consistent → The Disciplined → … The Legend*).
  - **Penalty**: two days in a row at 0% deducts credits and XP.
  - **Redeem** credits for gadgets/leisure gifts (with a redemption history you can undo).
  - **Buffet Feast** milestone unlocks after 30 days in a row at 80%+.
- **Settings** — appearance (dark mode + font size S/M/L/XL), **Google Drive sync**, data
  backup (export/import/reset), habit management (reorder / edit / add), and the built-in
  **Self-Discipline OS** guide.

## Google Drive sync

Settings → *Google Drive sync* backs up your data to your own Drive (in the private
`appDataFolder`). Because an OAuth Client ID is tied to the serving origin, you provide your
own: create a *Web* OAuth client in the Google Cloud Console, add this site's origin to the
authorized JavaScript origins, and paste the Client ID into Settings. Then **Connect Drive**,
use **Save now** / **Restore**, or enable **Auto live-sync** to upload after every edit.
Local **Export / Import** works as a no-setup fallback.

## Data model

Data is stored under the `momentum.habits.v1` key in `localStorage`:

- `habits[]` — `{ id, name, icon, color, type: "check" | "count", target, unit, freq, category, createdAt }`
- `records[dateISO][habitId]` — a number (1 for a completed check, or the count value)
- `notes[dateISO]` — `{ text, mood (0–4), score (0–10), updatedAt }`
- `meta[dateISO]` — `{ lastEntryAt }` (entry timestamp)
- `wallet` — `{ redemptions[], lastBuffetClaim }`

All credits/XP/streaks are **derived** from `records` so editing history stays consistent;
only spending (redemptions) is stored. First-run users are seeded with default habits and
~5 weeks of sample history so reports and calendar are immediately meaningful. Use
**Settings → Reset all data** to start fresh.

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
  app.js                   # router, sheet/toast host, view rendering, live clock
  store.js                 # state, localStorage, streak & stat logic, wallet
  gamify.js                # credits, XP, levels/identities, penalties, gifts, buffet
  drive.js                 # Google Drive sync (OAuth token flow + Drive REST)
  utils.js                 # DOM + date helpers
  charts.js                # dependency-free SVG/DOM charts
  habitForm.js             # create / edit / delete habit sheet
  views/
    today.js               # Today view + inline journal
    calendar.js            # Calendar (month/quarter, completion/mood/score)
    reports.js             # Reports view + journal trends
    rewards.js             # Level, credits, gifts, buffet
    settings.js            # appearance, Drive sync, data, manage, guide
    sheets.js              # habit detail sheet
```

No build step and no external dependencies.
