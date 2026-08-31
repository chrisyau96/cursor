# Google Drive backup setup (Money Manager style)

Momentum stores a JSON backup in Drive’s **app data folder** (hidden from the normal Drive file list). On the first launch of the day (or week), it uploads automatically.

## Create the OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. New project, e.g. `momentum-habits`.
3. APIs & Services → Enable **Google Drive API**.
4. OAuth consent screen:
   - User type: External
   - App name: Momentum
   - Support email: yours
   - Scopes: `https://www.googleapis.com/auth/drive.appdata`
   - Privacy policy: `https://chrisyau96.github.io/cursor/privacy.html`
   - Add your Gmail as a test user while the app is in Testing
5. Credentials → Create credentials → OAuth client ID → **Web application**
   - Authorized JavaScript origins:
     - `https://chrisyau96.github.io`
     - `http://localhost`
     - `https://localhost`
   - Copy the client ID (`….apps.googleusercontent.com`)
6. For Play Store later, also create an **Android** client with the app SHA-1.
7. For App Store later, create an **iOS** client with bundle id `app.momentum.habits`.

## In Momentum

Settings → Google Drive backup:

1. Paste the Web client ID.
2. Choose **Daily** or **Weekly**.
3. Tap **Connect Google Drive** and allow access.
4. First open of the day/week uploads automatically. **Backup now** / **Restore** are always available.

Tokens stay on the device. After the first Google account popup, daily/weekly backup is silent while that account remains on the phone. Disconnect removes the local token; you can also revoke Momentum in your Google Account → Security → Third-party access.

On the **Play Store app**, this is local Google Sign-In / token refresh — not a web-push login wall. If Android starts asking every time, add an Android OAuth client with the app’s SHA-1 (`docs/PLAY_STORE.md` §2.2 and §5).
