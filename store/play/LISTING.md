# Play Console — paste this

Play listing name (already created): **2-in-1 Habit & Journal Tracker**

In-app / home-screen name stays **Momentum** (shorter under the icon). Package name is `com.dincey.habitjournal`.

Privacy policy (live): https://chrisyau96.github.io/cursor/privacy.html

## You already created the app — do this next

On the Dashboard, open **Finish setting up your app → View tasks**. Work top to bottom. Closed testing stays locked until these are done.

### 1. Store listing (Grow users → Store presence → Main store listing)

| Field | Paste |
|---|---|
| App name | 2-in-1 Habit & Journal Tracker |
| App category | **Productivity** |
| Short description | Track habits, journal daily, and back up to Google Drive — free. |
| Full description | See `docs/STORE_LISTING.md` |

**Graphics** (this folder):

- App icon 512×512: `icon-512.png`
- Feature graphic 1024×500: `feature-graphic.png`
- Phone screenshots (at least 2): `screenshots/01-home.png` … `05-settings.png`

### 2. App content (same View tasks list)

- Privacy policy URL: `https://chrisyau96.github.io/cursor/privacy.html`
- Ads: **Yes, my app contains ads** (banner; hide forever with HK$38 lifetime IAP `remove_ads_lifetime`)
- Sign-in details: **All functionality is available without special access** (do not require a reviewer login)
- Content rating: start questionnaire → **Utility, Productivity, Calendar** / Lifestyle. No violence, no user-generated public sharing. **In-app purchases: Yes** (HK$38 lifetime remove-ads). On-device credits are not Play Billing.
- Target audience: do **not** select “Designed for children”. 18+ is safest
- News: No
- Data safety:
  - Data collected: **Yes**
  - Data types: Files and docs (optional Drive backup); App activity (habit completions inside that file); Advertising ID (AdMob); Purchases (Play Billing restore)
  - Shared with other companies: AdMob/Google for ads only. Sold: **No**
  - Encrypted in transit: Yes
  - Users can request deletion: Yes (Disconnect Drive + Google Account → Third-party access; reset advertising ID in Android settings)
  - Purpose: App functionality (backup, IAP) and advertising (until remove-ads)

### 3. Then Internal testing (you, same day)

After listing + content are complete, Dashboard → **Internal testing → View tasks**. Upload a signed `.aab` (`docs/PLAY_STORE.md`). Public users never see this.

### 4. Closed testing (before public Production)

Your dashboard locks Closed testing until setup is finished. New personal Play accounts then need a **closed test with at least 12 testers opted in for 14 days**, then **Apply for production**. Internal testing does not count.

## Package name

Must be `com.dincey.habitjournal` and match the Android app (`capacitor.config.json` `appId`). Set when you first upload an AAB; it cannot change.
