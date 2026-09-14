# Native widget sources

Copied into Capacitor projects by `npm run native:apply`. The `android/` project in this repo already has widgets applied.

Home-screen widgets (Play app only):

- **Today** — today’s habits with on-widget **+** and **reset** (does not open the app). Default **4×2**; drag taller for more rows.
- **Habit** — one habit (setup can pick Not specific). Default **2×1**.
- **Habits 1–8** — up to eight habits, including Not specific. Default **4×2**; drag taller for more rows.
- **Streak** — fire icon + current / best. Default **2×2**; 2×1 hides the subtitle.
- **Credits** — available balance. Default **2×2**.
- **Gift** — configured gift icon + progress. Default **2×2**.
- **Journal** — **+ journal**; opens today’s mood + note sheet. Default **2×2**.

The website Settings page is a preview only.

## Android

After `npx cap add android`:

1. `npm run native:apply` copies Java + layouts + the receiver snippet into `AndroidManifest.xml`.
2. In `MainActivity` (inside its existing `<activity>`), add:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="momentum" android:host="widget" />
</intent-filter>
```

3. POST_NOTIFICATIONS is added by the Capacitor Local Notifications plugin.

## iOS

1. Xcode → File → New → Target → Widget Extension.
2. Replace generated Swift with `MomentumWidget.swift`.
3. Signing & Capabilities → App Groups → `group.com.dincey.habitjournal` (app + widget).
4. Info → URL Types → scheme `momentum`.
5. iOS 17+ for interactive complete/reset buttons.
