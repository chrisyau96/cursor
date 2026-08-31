# Play Console — paste this

I cannot open Google Play Console or Google Cloud as you. After you click **Create app**, paste and upload from this folder.

Privacy policy (live): https://chrisyau96.github.io/cursor/privacy.html

## Create app

1. https://play.google.com/console → **All apps** → **Create app**
2. App name: `Momentum`
3. Default language: English (United States)
4. App or game: **App**
5. Free or paid: **Free**
6. Declarations: check Play policies / US export as shown → **Create**

## Store listing → Main store listing

| Field | Paste |
|---|---|
| App name | Momentum |
| App category | Productivity |
| Short description | Track habits, journal daily, and back up to Google Drive — free. |
| Full description | See `docs/STORE_LISTING.md` |

**Graphics** (this folder):

- App icon 512×512: `icon-512.png`
- Feature graphic 1024×500: `feature-graphic.png`
- Phone screenshots (at least 2): `screenshots/01-home.png` … `05-settings.png`

## App content

- Privacy policy URL: `https://chrisyau96.github.io/cursor/privacy.html`
- Ads: **No, my app does not contain ads**
- Content rating: start questionnaire → Category **Utility, Productivity, Calendar** / Lifestyle. No violence, no user-generated public sharing, no in-app purchases required
- Target audience: do **not** select “Designed for children”. 18+ is safest
- News: No
- Data safety:
  - Data collected: **Yes**, only if the user taps Connect Google Drive
  - Data types: Files and docs (backup JSON); App activity (habit completions inside that file)
  - Collected: yes (optional). Shared with other companies: **No**. Sold: **No**
  - Encrypted in transit: Yes
  - Users can request deletion: Yes (Disconnect Drive + Google Account → Third-party access)
  - Purpose: App functionality (backup)

## Package name

Must be `app.momentum.habits` and match the Android app (`capacitor.config.json` `appId`). Set when you first upload an AAB; it cannot change.

## What still needs your login

Google requires **your** Play Console and Cloud Console sessions. Upload the graphics above, create the Web + Android OAuth clients (`docs/GOOGLE_DRIVE.md`), then upload a signed `.aab` from Android Studio (`docs/PLAY_STORE.md`).
