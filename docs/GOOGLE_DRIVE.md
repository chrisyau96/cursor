# Google Drive backup setup

Habit & Journal stores a JSON backup as a **visible file** in your Google Drive (`Habit-Journal-backup.json`), using the Drive `drive.file` scope. Daily or weekly first-open uploads happen automatically after Connect.

## What Connect Google Drive does

Yes: **Connect Google Drive** is the Google sign-in / consent popup.

1. You tap **Connect Google Drive** in Settings.
2. Google shows an account picker, then asks you to allow **Habit & Journal**.
3. The app only requests `drive.file` (plus basic profile/email). That lets it create and update **files it created** — not the rest of your Drive.
4. After you allow it, the app creates `Habit-Journal-backup.json` in **your** My Drive if needed, then **Backup now** and Daily/Weekly auto-sync can update that same file.

You do **not** need to switch the OAuth app to **Production** for this. **External + Testing** plus your Gmails as test users is enough for you and a few testers.

---

On the **Play app**, Connect opens the Google account picker. The app creates the backup file if it does not exist, then keeps updating that same file.

On the **website**, Drive is optional. Use the Play app to connect if the website cannot open Google sign-in.

You already have a Google Cloud project named **Habit App**, signed in as **info@dincey.com**. Use that project. Do not create a second one.

---

## A. Branding (required before test users / any “production” switch)

Google now blocks Audience changes until Branding has **all four**: app name, support email, homepage URL, and privacy policy URL.

The error *Valid app name, support email, homepage URL and privacy policy URL are required for switching the app to external production mode* means those URL fields are still empty — **or** you tapped **Publish** / Production. Fill Branding, save, then **stay in Testing**.

Open **Google Auth Platform → Branding** (sometimes labelled Overview → Project configuration).

### 1. App Information

| Field | Enter |
|---|---|
| **App name** | `Habit & Journal` |
| **User support email** | `info@dincey.com` (pick it from the dropdown) |
| **App logo** | optional — skip, or upload `assets/icon-512.png` |

### 2. App domain / links (this is the missing piece)

| Field | Enter |
|---|---|
| **Application home page** | `https://chrisyau96.github.io/cursor/` |
| **Privacy policy URL** | `https://chrisyau96.github.io/cursor/privacy.html` |
| **Terms of service URL** | leave blank |

Save. If Google asks you to add an **Authorized domain**, it will try `github.io`.

`github.io` is a shared domain. Google often **rejects** it when you try to **Publish** the OAuth app to Production. That is expected. **Testing does not need a published OAuth app.**

If Branding refuses `github.io` even for save:

- Keep the privacy policy URL anyway if the field accepts it.
- Do **not** Publish.
- Stay on **Audience → External → Testing** and add test users.
- Optional later: host the homepage + privacy page on a domain you own (for example `dincey.com`) and use those URLs if you ever want Google verification.

### 3. Audience (while creating branding)

If you are still on the first-time wizard:

- Choose **External**.
- Developer contact: **info@dincey.com**
- Finish with **Create** / **Save**.

Do **not** click **Publish app** on the Audience page. Publishing is what triggers the production-mode error. Testing is the correct state for personal Drive backup.

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

---

## C. Test users (required while the app is in Testing)

1. Left sidebar → **Audience**.
2. Publishing status should stay **Testing**. Ignore **Publish app**.
3. Under **Test users**, add every Gmail that will tap Connect, including:
   - `info@dincey.com`
   - `waifaat@gmail.com`
   - any other tester Gmail
4. Save.

Until Google verification (not needed for Testing), only these accounts can Connect. Other accounts see *Access blocked: this app’s request is invalid* or *The app is currently being tested*.

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
4. **Authorized JavaScript origins** — add all of these, no trailing slash:
   - `https://chrisyau96.github.io`
   - `https://localhost`
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

Play Console **App signing** has two certificates. They look similar. They are not the same.

| Play Console heading | What it is | Use for OAuth? |
|---|---|---|
| **App signing key certificate** | The cert on the APK testers actually install from Play | **Yes — required** |
| **Upload key certificate** | The cert you use in Android Studio to upload the `.aab` | Only for a USB/local APK you signed yourself |

One Android OAuth client has **one** SHA-1 field. You cannot put both fingerprints on the same client.

1. **Create client** → Application type **Android**.
2. Name: `Habit Journal Android Play`.
3. Package name: `com.dincey.habitjournal`
4. SHA-1: Play Console → Test and release → Setup → **App signing** → section titled **App signing key certificate** (not Upload key) → SHA-1.
5. Create. **Do not** paste that client ID into the app.

Keep the existing `Habit Journal Android` client if its SHA-1 is the upload key (`A5:57:4B:…`). That one is for locally signed builds only. Play Internal testing will not match it. Google then shows *This client is not available to verify ownership because it is not a Google Play Store app*.

Debug SHA-1 only if you install from Android Studio / USB (third Android client, same package):

```bat
keytool -list -v -alias androiddebugkey -keystore %USERPROFILE%\.android\debug.keystore -storepass android -keypass android
```

Google matches the installed APK automatically. **Do not** paste the Android client ID into Settings.

---

## G. In Habit & Journal

### Play app note (Android)

On the Play app, **do not paste any Google client ID**. Connect uses the **Android** OAuth client automatically (package `com.dincey.habitjournal` + Play App signing SHA-1). The client ID field is hidden. Tap **Connect Google Drive** and pick your account **once**.

If Connect shows **Google Drive sign-in did not finish** on **63.0.3** or **63.0.4**, Google’s account picker result was cancelled because `MainActivity` is `singleTask` (63.0.4 still started the helper as a child of that activity). Install **63.0.5**. Connect runs `DriveConsentActivity` on its own task and posts the token back without `startActivityForResult`.

If Connect shows the account picker twice, then **Google rejected the OAuth client (Error 401 invalid_client)**, you are on **63.0.2**. That build sent a pasted client ID into Google’s web OAuth page and launched the picker a second time. Install **63.0.5**.

1. You must be on Play **63.0.5**. Settings footer must read **Habit & Journal 63.0.5**.
2. Android Studio **Generate Signed Bundle** copies `index.html` + `assets/` and stamps `version.json`.
3. Play Console → Test and release → Setup → **App signing** → copy SHA-1 from **App signing key certificate** (not **Upload key certificate**).
4. Google Cloud → **Create** another Android client: package `com.dincey.habitjournal`, that App signing SHA-1. Do not paste the client ID. One OAuth client cannot hold two SHA-1s.
5. Uninstall the app, install **63.0.5** from the opt-in link, confirm the footer, tap Connect. Do not type a client ID.

The **Web application** client ID is only for the website, not the Play app.

If Connect shows **Google Sign-In failed [16] Account reauth failed**:

Play Console can show an old **62.0.x** while Settings flashes **v59** then **v62**. Those are different files. Play reads Android `versionName`. The footer is HTML that a service worker used to cache. **63.0.0** stamps the same version into Play and the footer, and the WebView loads `/?v=63.0.0` so old HTML cannot paint first.

1. You must be on Play **63.0.5**. Settings footer must read **Habit & Journal 63.0.5**.
2. Android Studio **Generate Signed Bundle** copies `index.html` + `assets/` and stamps `version.json`.
3. Play Console → Test and release → Setup → **App signing** → copy SHA-1 from **App signing key certificate** (not **Upload key certificate**).
4. Google Cloud → **Create** another Android client: package `com.dincey.habitjournal`, that App signing SHA-1. Do not paste the client ID. One OAuth client cannot hold two SHA-1s.
5. Uninstall the app, install **63.0.5** from the opt-in link, confirm the footer, Connect again.

### Connect steps

Settings → Google Drive backup:

1. On the **Play app**: skip the client ID field (it is hidden). On the **website**: paste the **Web** client ID if the field is shown.
2. Choose **Daily**, **Weekly**, or **Off**.
3. Tap **Connect Google Drive** and pick a Google account that is a test user **once**.
4. Google’s consent screen appears. Allow Habit & Journal to create files in Drive.
5. The app creates `Habit-Journal-backup.json` in My Drive if needed.
6. **Backup now** / **Restore** stay available after connect. Daily/Weekly runs on the next first-open of that period.

Tokens stay on the device. Disconnect removes the local token. You can also revoke Habit & Journal in Google Account → Security → Third-party access.

---

## After Branding: the rest of the path

Do these in order. Stop after step 6 unless you later want Google verification (not required for testers).

1. **Branding** — app name, support email, homepage, privacy URL → Save.
2. **Audience** — External, **Testing**, add test users → Save. Do not Publish.
3. **Data access** — `openid`, `userinfo.email`, `userinfo.profile`, `drive.file`.
4. **Drive API** enabled on project **Habit App**.
5. **Clients** — Android (package + SHA-1; Play app uses this automatically) + Web application (website only).
6. Play app: **Connect Google Drive** → pick a test-user Gmail once → allow → **Backup now**. Website: paste Web client ID first.

`drive.file` is a sensitive scope. Publishing to Production usually starts a Google verification review. Skip that until you have a domain you own and a reason for strangers (not test users) to Connect.

See `docs/PLAY_STORE.md` for SHA-1 notes on Play App Signing.
