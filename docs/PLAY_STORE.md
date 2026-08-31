# Publish Momentum on Google Play (Android first)

This is the full path for a **free** Play Store listing. You do this on **your computer** (Windows, Mac, or Linux). This cloud environment cannot log into Play Console or upload an `.aab` for you.

The app is free for users. You pay **US$25 once** for a Play developer account.

---

## 0. Status of this repo

- Website (GitHub Pages) deploys only from `main`.
- Production-launch work (v56: Drive, reminders, widgets) lives on branch `cursor/production-launch-c514` / PR until it is merged.
- Until merge, https://chrisyau96.github.io/cursor/ is still the previous version and **privacy.html is not live**. Play Console needs a public privacy URL, so merge first or host `privacy.html` somewhere public.

---

## 1. What you get on Android (not the website)

**Reminders = Android local notifications, not web push / FCM.**  
When the user turns reminders on, Momentum asks for the system Notification permission, then registers repeating OS alarms (Capacitor `LocalNotifications`). Those alarms fire:

- App in the foreground — yes
- App in the background — yes
- App swiped away / not running — **yes**
- Phone rebooted — yes (plugin restores scheduled alarms)
- User force-stops the app in system Settings — no (Android cancels alarms until they open the app again)

No Firebase, no web-push server, no “backend push”. Tapping the notification opens Momentum.

**Google Drive = Google account popup once, then silent.**  
Connect Google Drive → official Google account picker + Drive app-data permission. After that, first open of the day (or week) uploads without another popup, as long as that Google account stays on the phone. If Google revokes access, Connect once more.

**Widgets = home-screen app widgets** (not the website). Long-press home screen → Widgets → Momentum. Mode is chosen in the app (Today, Habits, Streak, Credits, Gift, Journal). Today can complete/reset without signing in again.

---

## 2. One-time accounts and files

### 2.1 Play developer account

1. Use a Google account you will keep for years (losing it loses the listing).
2. Open [Play Console signup](https://play.google.com/console/signup).
3. Pay **US$25** (one time).
4. Complete **identity verification** (government ID). New accounts are blocked from publishing until this passes (can take 1–2 days).
5. If this is a **personal** account created after 13 Nov 2023: you **cannot** go straight to Production. You must run a **closed test with at least 12 testers opted in for 14 days**, then apply for production. Organization / older accounts skip this. Details in section 8.

### 2.2 Google Cloud (Drive + later Sign-In)

Follow `docs/GOOGLE_DRIVE.md`, then also create an **Android** OAuth client:

1. Cloud Console → your project → Credentials → Create OAuth client → **Android**
2. Package name: `app.momentum.habits`
3. SHA-1: from your upload keystore (section 5). You can add a debug SHA-1 first for testing:

```bash
keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android
```

4. Enable **Google Drive API**.
5. OAuth consent screen: app name Momentum, privacy policy URL, scope `drive.appdata`, add yourself as a test user while the app is in Testing.

---

## 3. Software on your PC

Install:

1. [Node.js 20+](https://nodejs.org/)
2. [Android Studio](https://developer.android.com/studio) (includes Android SDK + emulator)
3. In Android Studio → SDK Manager:
   - Android SDK Platform **35** or **36**
   - Android SDK Build-Tools
   - Google Play system images if you want an emulator with Play Store

Accept licenses:

```bash
sdkmanager --licenses
```

---

## 4. Build the Android app from this repo

```bash
git clone https://github.com/chrisyau96/cursor.git
cd cursor
git checkout cursor/production-launch-c514   # or main after merge

npm install
npm install @capacitor/core @capacitor/cli @capacitor/android \
  @capacitor/app @capacitor/filesystem @capacitor/local-notifications

npm run build:www
npx cap add android
npm run native:apply
npx cap sync android
```

In `android/app/src/main/AndroidManifest.xml`, inside the **MainActivity** `<activity>` (not at the bottom of `<application>`), add:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="momentum" android:host="widget" />
</intent-filter>
```

The Local Notifications plugin already adds `POST_NOTIFICATIONS` and a boot receiver.

Open the project:

```bash
npx cap open android
```

First run on a phone or emulator: Run ▶. On the device, allow notifications when Momentum asks. Turn on a habit reminder and wait, or use **Send test notification**.

---

## 5. Signing key (keep this forever)

Play requires a signed **Android App Bundle (`.aab`)**. If you lose the upload key, you cannot update the app easily.

In Android Studio: **Build → Generate Signed App Bundle / APK → Android App Bundle → Create new keystore**.

Suggested values:

- Key store path: somewhere you back up (not only this PC)
- Key alias: `momentum-upload`
- Validity: 25+ years
- Password: store in a password manager

Or CLI:

```bash
keytool -genkey -v -keystore momentum-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias momentum-upload
```

Copy the **SHA-1** of this keystore into the Android OAuth client (section 2.2). After Play App Signing is on, also add the **App signing key SHA-1** that Play Console shows (it differs from your upload key).

---

## 6. Version numbers

In `android/app/build.gradle` (or `android/app/build.gradle.kts`):

- `versionCode` — integer, must increase every upload (`1`, `2`, `3`…)
- `versionName` — what users see (`1.0.0`, `1.0.1`)

First Play upload: `versionCode 1`, `versionName "1.0.0"`.

---

## 7. Create the app in Play Console

1. [Play Console](https://play.google.com/console) → **Create app**
2. Name: **Momentum**
3. Default language: English (or Chinese if you prefer)
4. App or game: **App**
5. Free or paid: **Free**
6. Declarations: privacy policy, US export laws, etc. as they apply (this app has no ads, no IAP required)

Complete every item with a grey check on the dashboard:

### Store listing

- Short description (80 chars): see `docs/STORE_LISTING.md`
- Full description: same file
- App icon: 512×512 PNG (`assets/icon-512.png`)
- Feature graphic: 1024×500 PNG (you still need to export this; Play rejects listings without it)
- Phone screenshots: at least **2**, JPEG/PNG, 16:9 or 9:16. Capture from the emulator or a phone (Home, Habits, Report, Rewards, Settings)
- Tablet screenshots: optional for a phone-first app
- Privacy policy: `https://chrisyau96.github.io/cursor/privacy.html` (after merge)

### App content

- **Privacy policy** — same URL
- **Ads** — No
- **Content rating** — IARC questionnaire (Habit tracker / lifestyle; no violence, no user-to-user chat)
- **Target audience** — 18+ is safest unless you explicitly design for children. Do **not** tick “designed for children” (Families policy is strict)
- **News app** — No
- **COVID** — No
- **Data safety** — fill as follows:
  - Data collected? Only if the user opts into Google Drive. Types: app activity / files (the JSON backup). Encrypted in transit. User can delete by disconnecting Drive and using Google Account → Third-party access
  - Data shared with other companies? No (Drive is the user’s own Google account)
  - Sold? No
  - Optional: “Users can request deletion”

### Main store listing / package name

Package name must stay `app.momentum.habits` forever. It is set when you first upload an AAB and cannot change.

---

## 8. Upload a test build (do this before Production)

**Build → Generate Signed Bundle** → release `.aab`.

### Internal testing (you + 1–10 people, minutes)

1. Play Console → Test and release → Testing → **Internal testing**
2. Create testers list (Gmail addresses)
3. Create release → upload `.aab` → Review → Start rollout
4. Testers open the opt-in link on the phone (signed into that Gmail) → Install

Use this to confirm:

- Reminders fire with the app killed
- Drive: Google popup once, then a second launch the next day backs up with no popup
- Widget appears under Widgets → Momentum

### Closed testing (required for many new personal accounts)

1. Test and release → Testing → **Closed testing** → Create track
2. Add **at least 12–15** Gmail testers (friends/family)
3. Each person must **open the opt-in link** and install. Adding an email is not enough
4. Keep **12 opted-in continuously for 14 days**
5. Dashboard → **Apply for production** → answer the questionnaire honestly (how you recruited testers, what they reported, who the app is for)

Internal testing does **not** count toward the 14-day rule.

---

## 9. Production (public listing)

After production access is approved (or if your account is already allowed):

1. Test and release → **Production** → Create release
2. Upload the same or a newer `.aab` (`versionCode` +1 if you already uploaded this file)
3. Release notes, e.g. `First release of Momentum.`
4. Countries / regions
5. Submit for Google review (often 1–7 days)

When approved, search **Momentum** on Play or use the direct listing URL Play Console shows.

---

## 10. After you change the web app later

```bash
git pull
npm run build:www
npx cap sync android
npx cap open android
```

Bump `versionCode`, generate a new signed `.aab`, upload a new Production release.

GitHub Pages still updates automatically when `main` is pushed. The Play app does **not** update until you ship a new AAB.

---

## 11. Common blocks

| Problem | What to do |
|---|---|
| “Privacy policy is invalid” | Merge so `privacy.html` is on GitHub Pages, use the https URL |
| Notifications never appear | Android 13+: user must Allow. Check Settings → Apps → Momentum → Notifications |
| Drive popup every time | Add Android OAuth client with **both** upload-key SHA-1 and Play App Signing SHA-1 |
| “Package name already used” | `app.momentum.habits` must be unique; if taken, change `appId` in `capacitor.config.json` **before** the first upload |
| Closed test not counting | Testers did not click the opt-in link, or you used Internal instead of Closed |
| AAB rejected for target SDK | In Android Studio, set `targetSdk` to 35 or 36 (Play’s current floor) |
