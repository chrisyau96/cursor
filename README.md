# Momentum · Habit Tracker

A sophisticated, mobile-first **habit tracking web app**. Track habits with flexible
schedules, journal your mood and energy, review trends across a canvas chart and a
month/quarter calendar, and stay motivated with an XP **level/identity** ladder plus a
**credit / gift / penalty** reward system. It runs fully in the browser (no account, no
server) and installs as a PWA. Backup/sync uses a **local JSON file** (File System Access
API) that you can keep in a Google Drive / OneDrive / iCloud synced folder — no OAuth.

Live: https://chrisyau96.github.io/cursor/

## Features

- **Home** — a weekly strip (each day coloured by completion band with the day's mood +
  energy score), quick stat cards (streak, credits, next gift), today's habit list with
  one-tap `+1` logging and per-target progress, and an inline **journal** (mood + energy
  0–10 + reflection). A center **+ FAB** adds a habit.
- **Habits** — full habit setup (name, icon, colour, target count) with rich **frequency**:
  daily (choose weekdays), monthly, or custom quarterly/yearly with schedule rules
  (not-specified / specific date / nth weekday, month-in-quarter or month-in-year). Records
  are fully **editable/removable** with a recent log and a full log viewer.
- **Report** — a canvas **performance trend** (completion bars + energy line, 7/14/30 days)
  and a **calendar** with Month and Quarter views; each day is colour-banded and shows the
  mood + energy, and tapping a day opens a **Day Detail** sheet to add records or edit/delete
  the journal.
- **Journal** — history of all entries with edit/delete; entries also editable from the
  calendar day detail.
- **Level** — an XP-driven **identity ladder** of 10 tiers (Seed Planter → Freedom
  Operator) with a gradient identity card and XP history.
- **Gift** — credit balance, 80%+ streak, gift balance; **redeem** credits for anything you
  like (free-text spend) and redeem streak-based **gift rules** (e.g. Buffet after 30 days
  at 80%+); a live reward ledger.
- **Settings** — profile icon, tracker start date, **reward rules** (credit tiers + gift
  rules), **penalty rules** (credit/XP loss for consecutive 0% days), **Backup & Sync**
  (connect/create a JSON file + auto-sync, or export/import), reminders, and a danger zone.

## Rewards engine (all derived from your records)

- **Credit rules**: earn HK$ when a day reaches configured completion % (defaults: HK$2 at
  50%+, HK$10 at 100%). Higher-percentage days also satisfy the lower rules.
- **Gift rules**: unlock a gift after N consecutive days at a chosen % (default: Buffet at
  30 days of 80%+).
- **Penalty**: lose credits + XP each time consecutive 0% days reach the threshold
  (default: 2 days → −HK$5, −20 XP).
- **XP → Level**: completions grant XP; credit/gift/penalty ledger entries adjust it; your
  level maps to an identity.

Everything except redemptions is recomputed from `records`, so editing history stays
consistent. All times use the Asia/Hong_Kong day boundary.

## Backup & sync (no account)

Settings → **Backup & Sync**. On desktop Chrome/Edge, **Create New File** or **Connect
File** to a `.json` placed inside a cloud-synced folder, then turn on **Auto Sync** — every
edit writes to that file and your cloud app syncs it across devices. On phones (where the
File System Access API is limited), use **Export / Import JSON**. Data is always saved in
`localStorage` first.

## Use it on your phone

1. Open the live URL in Chrome/Safari → browser menu → **Add to Home Screen / Install app**
   (installable PWA, works offline).
2. For sync, keep the backup JSON in your Drive/OneDrive/iCloud folder as above.

## Run locally

Static site — serve over HTTP:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Project structure

```
index.html                 # app shell (top bar, views, bottom nav + FAB, modal)
assets/css/styles.css       # design system + all component styles
assets/js/app.js            # full engine: state, scheduling, records, journal,
                            #   trend/calendar, XP/level, reward ledger, file sync
manifest.webmanifest, sw.js # PWA (installable + offline)
assets/icon*.{svg,png}      # app icons
```

No build step, no external dependencies.
