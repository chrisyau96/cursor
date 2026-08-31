# Google Drive backup setup (Money Manager style)

Momentum stores a JSON backup in Drive’s **app data folder** (hidden from the normal Drive file list). On the first launch of the day (or week), it uploads automatically.

On the **website**, Google Identity Services shows a browser popup when the token expires.

On the **Play app**, native Google Sign-In + Credential Manager is used. After the first account picker, backup stays silent while that Google account remains on the phone. If Google revokes access, tap Connect once more.

## Create the OAuth clients (you must click this)

This environment cannot open your Google Cloud project.

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. New project, e.g. `momentum-habits`.
3. APIs & Services → Enable **Google Drive API**.
4. OAuth consent screen:
   - User type: External
   - App name: Momentum
   - Support email: yours
   - Scopes: `https://www.googleapis.com/auth/drive.appdata` (also email/profile/openid if the consent screen lists them)
   - Privacy policy: `https://chrisyau96.github.io/cursor/privacy.html`
   - Add your Gmail as a test user while the app is in Testing
5. Credentials → Create credentials → OAuth client ID → **Web application**
   - Authorized JavaScript origins: `https://chrisyau96.github.io`, `http://localhost`, `http://127.0.0.1`
   - Copy this ID into Momentum Settings → **Google Web client ID**
6. Credentials → Create credentials → OAuth client ID → **Android**
   - Package name: `com.dincey.habitjournal`
   - SHA-1: from your upload keystore (`keytool -list -v -keystore your.jks`) **and** later the Play App Signing SHA-1 from Play Console → Test and release → Setup → App signing
   - Also add the debug keystore SHA-1 if you install via USB / Android Studio
   - **Do not paste the Android client ID into Momentum.** Google matches the signed app automatically. Missing or wrong SHA-1 is why the WebView keeps asking.

## In Momentum

Settings → Google Drive backup:

1. Paste the **Web** client ID.
2. Choose **Daily** or **Weekly**.
3. Tap **Connect Google Drive** and allow access (one Google account picker).
4. First open of the day/week uploads automatically. **Backup now** / **Restore** are always available.

Tokens stay on the device. Disconnect removes the local token; you can also revoke Momentum in Google Account → Security → Third-party access.

See `docs/PLAY_STORE.md` §2 and §4 for SHA-1 commands.
