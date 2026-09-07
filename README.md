# Habit & Journal

A sophisticated, mobile-first **habit tracking web app**. Track habits with flexible
schedules, journal your mood and energy, review trends across a canvas chart and a
month/quarter calendar, and stay motivated with an XP **level/identity** ladder plus a
**credit / gift / penalty** reward system. It runs fully in the browser (no account, no
server) and installs as a PWA. Optional **Google Drive** backup uploads on the first open
of the day or week.

Live: https://chrisyau96.github.io/cursor/

To publish on Google Play and the App Store (free app, paid developer accounts), see
[`docs/PUBLISH.md`](docs/PUBLISH.md).

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
- **Settings** — profile, reward rules, **Google Drive backup** (daily/weekly), local file
  backup, reminders, home-screen widget layout, and a danger zone.

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

## Backup

Settings → **Google Drive backup**: connect once, then Momentum uploads on the first launch
of the day or week (see `docs/GOOGLE_DRIVE.md`). Desktop Chrome/Edge can still **Create /
Connect** a JSON file for local auto-sync. Phones should use Drive.

## Home screen widgets (store app)

Settings → **Home screen widgets** chooses the mode (today tasks, 1–6 habits with due dates,
streak, credits, gift, journal). The Play / App Store build can complete or reset today’s
tasks from the widget. The website shows a preview only.

## Use it on your phone

1. Open the live URL in Chrome/Safari → browser menu → **Add to Home Screen / Install app**
   (installable PWA, works offline).
2. For backup on a phone, connect Google Drive in Settings (daily or weekly).

## Run locally

Static site — serve over HTTP:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
node scripts/test-launch.mjs  # Drive / reminder / widget unit tests
```

## Project structure

```
index.html                 # app shell
assets/js/app.js           # habit engine
assets/js/launch-core.js   # Drive / reminder / widget helpers
assets/js/launch.js        # Google Drive, notifications, widget snapshot
native-src/                # Android + iOS widget sources for Capacitor
docs/PUBLISH.md            # Play Store + App Store steps
privacy.html               # store / OAuth privacy policy
```

The GitHub Pages site has no build step. Store binaries use Capacitor (`docs/PUBLISH.md`).
