# UAT vs production (best practice)

You can keep shipping new features without touching people who already installed Momentum from Play. We can do this together: I prepare the Android project and Internal `.aab` notes on a branch; you click rollout in Play Console (that login has to be yours).

## Recommended setup

| Track | Who | Package | When to use |
|---|---|---|---|
| **GitHub Pages** | You, in a browser | n/a | Fast UI checks. Updates on every `main` merge |
| **Play Internal testing** | You + a few Gmails | `app.momentum.habits` | **Default UAT.** Real Android (notifications, Drive, widgets). Testers opt in. **Public Play users never see this** |
| **Play Closed testing** | 12+ friends for 14 days | same package | Required for many **personal** developer accounts created after 13 Nov 2023 before Production |
| **Play Production** | Everyone | `app.momentum.habits` | Stable releases only |
| **Second package (optional)** | You, two icons on one phone | `app.momentum.habits.uat` | Only if you need Production **and** UAT installed at once. Not needed to start |

You do **not** need a separate UAT Play listing to test safely. Internal testing on the same app is the Google-recommended path.

## How we work together

1. New work on a branch → PR → merge `main` when it is ready (website updates).
2. I keep `android/` in the repo. You run `npm install && npm run cap:sync`, then Android Studio → **Generate Signed Bundle**.
3. Upload that `.aab` to **Internal testing**. Production stays on the last Production AAB until you promote.
4. When a build is good, promote the same artifact (or a newer `versionCode`) to Production.

I cannot click **Create app** or **Start rollout** in your Play Console.

## Same phone, two installs?

Internal testing **replaces** the Production install if both use `app.momentum.habits`. That is usually what you want (you test the next build). If you must keep the public build and a debug build side by side, say so and we add a Gradle `uat` flavor with applicationId `app.momentum.habits.uat` (second icon; Drive Android OAuth client needs that package + SHA-1 too).
