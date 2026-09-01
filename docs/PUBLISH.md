# Publish Momentum to Google Play and the App Store

The web app at GitHub Pages remains a PWA. Store listing requires a **native shell** (Capacitor). The app itself can be **free**; the developer accounts are not.

## What can ship directly vs what needs the store app

| Feature | GitHub Pages PWA | Play / App Store app |
|---|---|---|
| All current habit / journal / reward features | Yes | Yes |
| Google Drive daily/weekly backup | Yes (after you add an OAuth client ID) | Yes |
| Reminders while the app is **open** | Yes | Yes |
| Reminders while the app is **closed** | No (browsers do not allow reliable local alarms) | Yes (`LocalNotifications`) |
| Home screen widgets (today / habits / streak / credits / gift / journal, complete & reset) | Preview only in Settings | Yes (Android App Widget + iOS WidgetKit) |

Widgets and closed-app reminders **cannot** be added to the current website alone. That is a platform limit, not a missing button.

## Costs (the app can still be free)

- **Google Play Console**: one-time ~US$25
- **Apple Developer Program**: ~US$99 / year
- You can set the price to **Free** on both stores

## 1. Google Drive (do this first — needed for PWA and the stores)

Follow `docs/GOOGLE_DRIVE.md`. You will paste the Web client ID into Settings → Google Drive backup.

Authorized JavaScript origins to add:

- `https://chrisyau96.github.io`
- `http://localhost` (Capacitor / local)
- `https://localhost` (iOS)

## Google Play first (recommended)

Full walkthrough (accounts, Android Studio, signing, closed testing, production): **[docs/PLAY_STORE.md](./PLAY_STORE.md)**.

### Android (Windows, macOS, or Linux)

1. Install [Android Studio](https://developer.android.com/studio) and the Android SDK.
2. Install Node 20+.
3. In this repo:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/app @capacitor/filesystem @capacitor/local-notifications
npm run build:www
npx cap init "Momentum" "com.dincey.habitjournal" --web-dir www
npx cap add android
npm run native:apply
npx cap sync android
npx cap open android
```

4. In Android Studio, add the `momentum://widget` intent filter to `MainActivity` (see snippet in `native-src/android/README.md`).
5. Create a Play upload keystore (keep it private; losing it blocks updates).
6. Build → Generate Signed App Bundle (`.aab`).

### iOS (Mac required)

1. Install Xcode from the Mac App Store.
2. Same `npm` / `build:www` steps, then:

```bash
npx cap add ios
npm run native:apply
npx cap sync ios
npx cap open ios
```

3. In Xcode: add a **Widget Extension** target, replace it with files from `ios/App/MomentumWidgets`, enable App Group `group.com.dincey.habitjournal` on the app **and** the widget, set the URL scheme `momentum`.
4. Archive → Distribute to App Store Connect.

## 3. Store listings (both stores)

Prepare:

- App name: **Momentum**
- Short description: habit tracker with journal, streaks, credits, and Drive backup
- Full description: see `docs/STORE_LISTING.md`
- Privacy policy URL: `https://chrisyau96.github.io/cursor/privacy.html` (after this ships to GitHub Pages)
- Icon: 512×512 (`assets/icon-512.png`) plus a 1024×1024 App Store icon
- Screenshots: phone, 6.7" and 5.5" (iOS) / phone + 7" tablet (Play)
- Content rating questionnaire (no user-generated public content; no ads)
- Support URL / email

## 4. Google Play Console

1. Pay the developer fee and create the app (Free, Productivity).
2. Complete Data safety: data is stored on device; Drive backup is optional user-initiated cloud backup; no selling of data.
3. Upload the `.aab` to Internal testing, then Production.
4. Countries, ads declaration (no ads).

Review often takes a few days.

## 5. App Store Connect

1. Enroll in the Apple Developer Program.
2. Create the app record (bundle id `com.dincey.habitjournal`).
3. Fill Privacy Nutrition Labels to match `privacy.html`.
4. Upload the archive via Xcode, submit for review with the TestFlight build.

Review often takes 1–3 days.

## 6. After each web change

```bash
npm run build:www
npx cap sync
```

Then ship a new store build. GitHub Pages still updates from `main` automatically.

## Limits to expect

- **iOS widgets** need Xcode on a Mac; this Linux environment cannot compile them.
- **Interactive widgets** (complete/reset on the widget) need iOS 17+ and Android 8+.
- Google may take extra review the first time you use Drive OAuth.
- You cannot publish under Apple’s account from this cloud agent; you must archive on your Mac.
