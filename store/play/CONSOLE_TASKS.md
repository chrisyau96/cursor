# Remaining Play Console tasks (2 of 11 done)

Play listing name: **2-in-1 Habit & Journal Tracker**  
Package (Play + AAB): **com.dincey.habitjournal**  
In-app name: **Momentum**

Privacy and category are already done. Open each remaining task from Dashboard → Finish setting up your app → View tasks.

## Sign-in details — select **No**

Choose **All functionality is available without special access**.

Do **not** select the restricted / “yes, reviewers need a login” option. There is no required account. Google reviewers can use every screen. Google Drive backup is optional and they can skip Connect.

### If you already submitted Yes

This is not locked. Edit it:

1. Play Console → your app → left menu **Policy and programs → App content** (or Dashboard → Finish setting up → **Sign-in details**)
2. Sign-in details → **Manage** (or **Edit**)
3. Switch to **All functionality is available without special access**
4. Delete any username / password / notes you typed
5. **Save**

The green check stays. You do not start the whole 11-task setup over.

## Monetize — one lifetime product

Play Console → Monetize → In-app products → Create product.

| Field | Value |
|---|---|
| Product ID | `remove_ads_lifetime` (cannot change later) |
| Name | Remove ads |
| Description | Remove all ads forever |
| Status | Active |
| Price | **HK$38** (one-time managed product, not a subscription) |

The Play app buys this SKU and hides every banner. Restore purchase uses the same Google account.

## Ads — **Yes**

**Yes, my app contains ads.**

Free users see a banner (house ad, plus AdMob in the Play app). A one-time **HK$38** Play purchase (`remove_ads_lifetime`) removes every ad for life. Restore works on a new phone with the same Google account.

## Content rating

Start questionnaire → IARC.

| Question | Answer |
|---|---|
| Category | Utility, Productivity, Communication / Lifestyle |
| Violence | None |
| Sexual content | None |
| Language | None / mild if asked |
| Controlled substances | None |
| User interaction / UGC | No public sharing, no user-to-user chat |
| In-app purchases | **Yes** — one lifetime product: remove ads, HK$38. On-device “credits” are play money, not Play Billing |
| Location sharing | No |
| Digital purchases | Yes (the remove-ads IAP only) |

Submit and apply the rating it gives (usually Everyone / PEGI 3).

## Target audience

- Do **not** tick Designed for children / Families
- Age groups: **18 and over** is safest
- Store presence: appeal to the age group you selected
- News app: No
- COVID-19: No

## Data safety

Collected? **Yes**.

| Prompt | Answer |
|---|---|
| Data collected | Yes |
| Data types | **Files and docs** (optional Drive backup JSON). **App activity** only as habit completions inside that file. **Device or other IDs → Advertising ID** (Google AdMob, ads only). **Purchases** (Play Billing, restore remove-ads) |
| Collected | Yes |
| Shared with other companies | Advertising ID is processed by Google AdMob for serving ads. Drive stays in the user’s Google account. **Not sold** |
| Sold | **No** |
| Encrypted in transit | Yes |
| Users can request deletion | Yes |
| Purpose | App functionality (backup, IAP restore). Advertising (banner ads until remove-ads is bought) |
| Optional vs required | Drive and ads-ID for ads are optional. The app works after remove-ads with no ads SDK calls |

Deletion: Disconnect Drive in Settings, and Google Account → Security → Third-party access.

## Government apps — **No**

Not developed by or for a government.

## Financial features

**My app doesn’t provide any financial features.**

On-device “credits” are a streak reward, not banking, loans, payments, or real money.

## Health

**My app doesn’t provide any health features.**

Mood/energy in the journal is a diary field, not medical advice, fitness tracking, or Health Connect. Do not pick mental-health / medical categories (those trigger extra policy you have not built).

## Store listing

Upload from `store/play/`:

- Name: `2-in-1 Habit & Journal Tracker`
- Short / full description: `docs/STORE_LISTING.md`
- Icon: `icon-512.png`
- Feature graphic: `feature-graphic.png`
- Screenshots: `screenshots/01-home.png` … `05-settings.png` (at least two)

Privacy URL (already set): https://chrisyau96.github.io/cursor/privacy.html
