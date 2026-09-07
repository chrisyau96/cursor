# Google Drive backup setup

Habit & Journal stores a JSON backup as a **visible file** in your Google Drive (`Habit-Journal-backup.json`), using the Drive `drive.file` scope. Daily or weekly first-open uploads happen automatically after Connect.

On the **Play app**, Connect opens the Google account picker. The app creates the backup file if it does not exist, then keeps updating that same file.

On the **website**, Drive is optional. Use the Play app to connect if the website cannot open Google sign-in.

## Create the OAuth clients (developer, once)

Testers usually never paste a client ID. If this build has no baked ID, Settings → Google Drive shows **Google Web client ID**. Paste the Web application client ID (ends with `.apps.googleusercontent.com`), then tap Connect.

You create these in Google Cloud (Play developer login is **info@dincey.com**):

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. New project, e.g. `habit-journal`.
3. APIs & Services → Enable **Google Drive API**.
4. OAuth consent screen:
   - User type: External
   - App name: Habit & Journal
   - Support email: yours
   - Scopes: `https://www.googleapis.com/auth/drive.file` (also email/profile/openid if listed)
   - Privacy policy: `https://chrisyau96.github.io/cursor/privacy.html`
   - Add your Gmail as a test user while the app is in Testing
5. Credentials → Create credentials → OAuth client ID → **Web application**
   - Authorized JavaScript origins: `https://chrisyau96.github.io`, `http://localhost`, `http://127.0.0.1`
   - Paste this Web client ID into Settings → Google Drive, or bake it in `index.html` as `window.MOMENTUM_CONFIG.googleClientId`
6. Credentials → Create credentials → OAuth client ID → **Android**
   - Package name: `com.dincey.habitjournal`
   - SHA-1: from your upload keystore (`keytool -list -v -keystore your.jks`) **and** the Play App Signing SHA-1 from Play Console → Test and release → Setup → App signing
   - Also add the debug keystore SHA-1 if you install via USB / Android Studio
   - Do **not** paste the Android client ID into the app. Google matches the signed app automatically.

## In Habit & Journal

Settings → Google Drive backup:

1. Paste the **Google Web client ID** if the field is shown.
2. Choose **Daily**, **Weekly**, or **Off**.
3. Tap **Connect Google Drive** and pick a Google account.
4. The app creates `Habit-Journal-backup.json` in My Drive if needed, then points later backups at that file.
5. **Backup now** / **Restore** stay available after connect.

Tokens stay on the device. Disconnect removes the local token; you can also revoke Habit & Journal in Google Account → Security → Third-party access.

See `docs/PLAY_STORE.md` §2 and §4 for SHA-1 commands.
