# Google Drive backup setup (Money Manager style)

Momentum stores a JSON backup in Drive’s **app data folder** (hidden from the normal Drive file list). Daily or weekly first-open uploads happen automatically after Connect.

On the **Play app**, Connect opens the Google account picker. After the first sign-in, backup stays silent while that Google account remains on the phone.

On the **website**, Drive is optional. Use the Play app to connect if the website cannot open Google sign-in.

## Create the OAuth clients (developer, once)

Testers never paste a client ID. You create these in Google Cloud, then bake the **Web** client ID into the app build (`window.MOMENTUM_CONFIG.googleClientId` in `index.html`).

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. New project, e.g. `momentum-habits`.
3. APIs & Services → Enable **Google Drive API**.
4. OAuth consent screen:
   - User type: External
   - App name: Momentum
   - Support email: yours
   - Scopes: `https://www.googleapis.com/auth/drive.appdata` (also email/profile/openid if listed)
   - Privacy policy: `https://chrisyau96.github.io/cursor/privacy.html`
   - Add your Gmail as a test user while the app is in Testing
5. Credentials → Create credentials → OAuth client ID → **Web application**
   - Authorized JavaScript origins: `https://chrisyau96.github.io`, `http://localhost`, `http://127.0.0.1`
   - Put this Web client ID in `index.html` as `window.MOMENTUM_CONFIG.googleClientId`
6. Credentials → Create credentials → OAuth client ID → **Android**
   - Package name: `com.dincey.habitjournal`
   - SHA-1: from your upload keystore (`keytool -list -v -keystore your.jks`) **and** the Play App Signing SHA-1 from Play Console → Test and release → Setup → App signing
   - Also add the debug keystore SHA-1 if you install via USB / Android Studio
   - Do **not** paste the Android client ID into the app. Google matches the signed app automatically.

## In Momentum

Settings → Google Drive backup:

1. Choose **Daily**, **Weekly**, or **Off**.
2. Tap **Connect Google Drive** and pick a Google account.
3. **Backup now** / **Restore** stay available after connect.

Tokens stay on the device. Disconnect removes the local token; you can also revoke Momentum in Google Account → Security → Third-party access.

See `docs/PLAY_STORE.md` §2 and §4 for SHA-1 commands.
