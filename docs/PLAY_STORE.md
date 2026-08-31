# Publish Momentum on Google Play (Android first)

This is the shortest path to a **free** Play listing. GitHub Pages is already live. The Android project lives in `android/` in this repo.

**This cloud environment cannot log into Play Console or Google Cloud as you.** It also cannot compile a signed `.aab` (no Android SDK / your upload keystore). You still click **Create app**, upload graphics, and **Generate Signed Bundle** on your computer. Everything you paste and upload is already in `store/play/`.

The app is free for users. You pay **US$25 once** for a Play developer account (you already have this).

---

## 0. What is already done

- Website: https://chrisyau96.github.io/cursor/ (v56+)
- Privacy policy (live): https://chrisyau96.github.io/cursor/privacy.html
- Store listing copy + graphics: `store/play/`
- Capacitor Android app id: `com.dincey.habitjournal`
- Home-screen widgets (Today complete/reset, 1–6 habits, streak, credits, gift, journal)
- Local reminders via OS alarms (not web push)
- Drive backup: Google account picker **once**, then silent — needs an **Android OAuth client + SHA-1** (section 2)

---

## 1. What you get on Android (not the website)

**Reminders = Android local notifications, not FCM / web push.**  
They fire with the app in the background, swiped away, or after reboot. Force-stop in system Settings cancels alarms until the next open.

**Google Drive = one Google popup, then silent.**  
Connect once. Daily/weekly first-open backup does not ask again while that Google account stays on the phone. If Google revokes access, Connect once more. This needs a **Web** OAuth client (paste in Settings) **and** an **Android** OAuth client with package `com.dincey.habitjournal` + signing SHA-1 (you do **not** paste the Android client ID in the app).

**Widgets = home-screen app widgets** (Play app only). The website Settings page is a preview. Long-press home screen → Widgets → Momentum.

---

## 2. Google Cloud (Drive) — you click this once

Follow `docs/GOOGLE_DRIVE.md`. Short version:

1. [Google Cloud Console](https://console.cloud.google.com/) → new project `momentum-habits`
2. Enable **Google Drive API**
3. OAuth consent screen: External, app name Momentum, privacy `https://chrisyau96.github.io/cursor/privacy.html`, scope `https://www.googleapis.com/auth/drive.appdata`, add yourself as a test user
4. Credentials → **Web application** client. Authorized JavaScript origins: `https://chrisyau96.github.io` and `http://localhost`. Copy the client ID into Momentum Settings → Google Web client ID
5. Credentials → **Android** client. Package: `com.dincey.habitjournal`. SHA-1 from your upload keystore (section 5) **and later** Play App Signing SHA-1 (Play Console → Test and release → Setup → App signing). You can also add the debug keystore SHA-1 for USB installs

```bash
keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android
keytool -list -v -alias momentum-upload -keystore /path/to/momentum-upload.jks
```

The Android client ID is **not** pasted into the app. Google matches the signed APK/AAB automatically. Missing SHA-1 is why WebView keeps asking.

---

## 3. Do I need Node and Android Studio?

| Step | Required? |
|---|---|
| `npx cap add android` | **No.** `android/` is already in the repo |
| Node 20+ | **Yes, once per machine** — `npm install` so Gradle can find Capacitor libraries |
| Android Studio (or SDK + JDK) | **Yes, once** — only Android Studio (or `bundletool` + SDK) can produce a **signed** Play `.aab` with **your** keystore. This environment cannot do that |
| Create app in Play Console | **Yes, you click it** — Google requires *your* developer login. Paste from `store/play/LISTING.md` |

After Node + Android Studio are installed:

```bash
git clone https://github.com/chrisyau96/cursor.git
cd cursor
git checkout cursor/play-android-c514   # or main after this branch is merged
npm install
npm run cap:sync
npx cap open android
```

First run: Run ▶ on a phone or emulator. Allow notifications. Turn on a habit reminder or tap **Send test notification**.

---

## 4. Signing key (keep this forever)

Play requires a signed **Android App Bundle (`.aab`)**. Lose the upload key and updates become painful.

Android Studio: **Build → Generate Signed App Bundle / APK → Android App Bundle → Create new keystore**.

- Path: somewhere you back up (not only this PC)
- Alias: `momentum-upload`
- Validity: 25+ years
- Password: password manager

```bash
keytool -genkey -v -keystore momentum-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias momentum-upload
```

Never commit `.jks` files. Copy SHA-1 into the Android OAuth client (section 2). After Play App Signing is on, also add the **App signing key SHA-1**.

---

## 5. Version numbers

In `android/app/build.gradle`:

- `versionCode` — integer, must increase every upload (`1`, `2`, `3`…)
- `versionName` — what users see (`1.0.0`)

First Play upload: `versionCode 1`, `versionName "1.0.0"`.

---

## 6. Create the app in Play Console (paste from `store/play/LISTING.md`)

Listing name **2-in-1 Habit & Journal Tracker** is already created. Next: Dashboard → **Finish setting up your app → View tasks**.

If you ever create another app:

1. [Play Console](https://play.google.com/console) → **Create app**
2. Name: **2-in-1 Habit & Journal Tracker**
3. Default language: English (United States)
4. App or game: **App**
5. Free or paid: **Free**
6. Declarations: privacy policy / US export as shown → **Create**

Then complete grey checks:

### Store listing

Upload from this repo (already sized):

| Asset | File | Size |
|---|---|---|
| App icon | `store/play/icon-512.png` | 512×512 |
| Feature graphic | `store/play/feature-graphic.png` | 1024×500 |
| Phone screenshots (need ≥2) | `store/play/screenshots/01-home.png` … `05-settings.png` | 1170×2080 |

- App name: **2-in-1 Habit & Journal Tracker** (in-app name stays Momentum)
- Short / full description: `docs/STORE_LISTING.md`
- Category: **Productivity**
- Privacy: `https://chrisyau96.github.io/cursor/privacy.html`

### App content

- **Ads** — No
- **Content rating** — Utility / Productivity / Lifestyle; no violence; no public user chat
- **Target audience** — do **not** tick “designed for children”. 18+ is safest
- **News / COVID** — No
- **Data safety**
  - Collected? **Yes, optional**, only if the user taps Connect Google Drive
  - Types: Files and docs (backup JSON); App activity (habit completions inside that file)
  - Shared with other companies? **No** (Drive is the user’s own Google account)
  - Sold? **No**
  - Encrypted in transit: Yes
  - Users can request deletion: Yes (Disconnect Drive + Google Account → Third-party access)

Package name is locked to `com.dincey.habitjournal` on the first AAB upload. It cannot change.

---

## 7. Upload a test build (do this before Production)

**Build → Generate Signed Bundle** → release `.aab`.

### Internal testing (best UAT — you + a few Gmails, minutes)

Public Play users **never** see this. Same package as Production.

1. Play Console → Test and release → Testing → **Internal testing**
2. Testers list (your Gmail)
3. Create release → upload `.aab` → Start rollout
4. Open the opt-in link on the phone (signed into that Gmail) → Install

Confirm: reminders with the app killed; Drive popup once then silent; Widgets → Momentum.

### Closed testing (only if Google blocks Production)

Personal accounts created after 13 Nov 2023 often must run a closed test with **12 testers opted in for 14 days**, then apply for production. Internal testing does **not** count. See `docs/UAT_TRACK.md`.

---

## 8. Production

1. Test and release → **Production** → Create release
2. Upload `.aab` (`versionCode` +1 if this file was already uploaded)
3. Release notes: `First release of Momentum.`
4. Submit for review (often 1–7 days)

---

## 9. After you change the web app later

```bash
git pull
npm install
npm run cap:sync
npx cap open android
```

Bump `versionCode`, generate a new signed `.aab`, upload Internal (UAT) or Production.

GitHub Pages updates on every `main` merge. The Play app updates only when you ship a new AAB.

---

## 10. Common blocks

| Problem | What to do |
|---|---|
| “Privacy policy is invalid” | Use `https://chrisyau96.github.io/cursor/privacy.html` |
| Notifications never appear | Android 13+: Allow. Settings → Apps → Momentum → Notifications |
| Drive popup every time | Android OAuth client with **both** upload-key SHA-1 and Play App Signing SHA-1. Paste the **Web** client ID in Settings |
| “Package name already used” | `com.dincey.habitjournal` must be unique; change `appId` in `capacitor.config.json` **before** the first upload |
| Closed test not counting | Testers did not click the opt-in link, or you used Internal instead of Closed |
| AAB rejected for target SDK | `targetSdk` is 35 in `android/variables.gradle` |
