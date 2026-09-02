# Native widget sources

Copied into Capacitor projects by `npm run native:apply`. The `android/` project in this repo already has widgets applied.

Home-screen widgets (Play app only): Today with complete/reset, 1–6 habits + due, streak, credits, gift, journal. The website Settings page is a preview only.

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
