# Google Drive backup setup

Habit & Journal stores a JSON backup as a **visible file** in your Google Drive (`Habit-Journal-backup.json`), using the Drive `drive.file` scope. Daily or weekly first-open uploads happen automatically after Connect.

On the **Play app**, Connect opens the Google account picker. The app creates the backup file if it does not exist, then keeps updating that same file.

On the **website**, Drive is optional. Use the Play app to connect if the website cannot open Google sign-in.

You already have a Google Cloud project named **Habit App**, signed in as **info@dincey.com**. Use that project. Do not create a second one.

---

## A. Branding (the screen you are on now)

You are in **Google Auth Platform → Overview / Create branding → Project configuration**.

### 1. App Information

| Field | Enter |
|---|---|
| **App name** | `Habit & Journal` |
| **User support email** | `info@dincey.com` (pick it from the dropdown) |

The red *Application name must not be empty* error goes away after you type the app name.

Tap **Next**.

If Google later asks for an app logo, skip it for now. You can add `assets/icon-512.png` later.

### 2. Audience

Choose **External**.

This app is personal / small-audience. External + Testing is the correct type. Do **not** pick Internal (that is only for Google Workspace orgs).

Tap **Next**.

### 3. Contact Information

Developer contact email: **info@dincey.com**

Tap **Next**.

### 4. Finish

Read the confirmation, then tap **Create** (not Cancel).

If Google shows **Finish** instead of Create, tap that, then save.

---

## B. Data access (scopes)

1. Left sidebar → **Data access**.
2. **Add or remove scopes**.
3. Enable:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
   - `https://www.googleapis.com/auth/drive.file`  
     (search for `drive.file` if it is not in the first list)
4. Save.

`drive.file` only lets the app see files **it created**. That is the Habit-Journal backup file. Do not add full Drive access.

If there is a **Privacy policy** field anywhere in Branding / Settings, use:

`https://chrisyau96.github.io/cursor/privacy.html`

---

## C. Test users (required while the app is in Testing)

1. Left sidebar → **Audience**.
2. Under **Test users**, add every Gmail that will tap Connect, including:
   - `info@dincey.com`
   - `waifaat@gmail.com`
   - any other tester Gmail
3. Save.

Until Google verification (not needed for Testing), only these accounts can Connect.

---

## D. Enable the Drive API

1. Open [Google Cloud Console](https://console.cloud.google.com/) and confirm the project picker says **Habit App**.
2. **APIs & Services → Library**.
3. Search **Google Drive API** → **Enable**.

---

## E. Web application client (this ID is the one you paste into the app)

1. Google Auth Platform → **Clients** (or APIs & Services → Credentials).
2. **Create client** → Application type **Web application**.
3. Name: `Habit Journal Web`.
4. **Authorized JavaScript origins** — add all three, no trailing slash:
   - `https://chrisyau96.github.io`
   - `http://localhost`
   - `http://127.0.0.1`
5. Leave **Authorized redirect URIs** empty unless Google marks it required. If it does, add:
   - `https://chrisyau96.github.io`
   - `http://localhost`
6. Create. Copy the **Client ID**. It ends with `.apps.googleusercontent.com`.

That Web client ID is what Settings → Google Drive expects. You can also bake it later in `index.html` as `window.MOMENTUM_CONFIG.googleClientId`. Do **not** invent or guess an ID.

**Authorized JavaScript origins** are the pages that run Google sign-in. They are **not** the Play package name and **not** an email address.

---

## F. Android client (do not paste this ID into the app)

1. **Create client** → Application type **Android**.
2. Name: `Habit Journal Android`.
3. Package name: `com.dincey.habitjournal`
4. SHA-1: add **each** signing cert you use.

From your upload keystore on Windows:

```bat
keytool -list -v -keystore C:\Users\User\momentum-upload.jks -alias upload
```

Also add:

- Play Console → Test and release → Setup → App signing → **App signing key certificate** SHA-1
- Debug SHA-1 if you install from Android Studio / USB:

```bat
keytool -list -v -alias androiddebugkey -keystore %USERPROFILE%\.android\debug.keystore -storepass android -keypass android
```

Google matches the signed APK/AAB automatically. **Do not** paste the Android client ID into Settings.

---

## G. In Habit & Journal

Settings → Google Drive backup:

1. Paste the **Web** client ID into **Google Web client ID** if the field is shown.
2. Choose **Daily**, **Weekly**, or **Off**.
3. Tap **Connect Google Drive** and pick a Google account that is a test user.
4. The app creates `Habit-Journal-backup.json` in My Drive if needed.
5. **Backup now** / **Restore** stay available after connect.

Tokens stay on the device. Disconnect removes the local token. You can also revoke Habit & Journal in Google Account → Security → Third-party access.

See `docs/PLAY_STORE.md` for SHA-1 notes on Play App Signing.
