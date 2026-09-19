package com.dincey.habitjournal;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Scope;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Hosts Google AuthorizationClient on its own task (taskAffinity + singleTask).
 * MainActivity is singleTask; a child activity's startActivityForResult is
 * cancelled when Google's picker finishes and the task root is resumed.
 * Results are posted back through DriveAuthPlugin.completeOk/completeError.
 */
public class DriveConsentActivity extends ComponentActivity {
  public static final String EXTRA_INTERACTIVE = "interactive";

  private static final String TAG = "DriveAuth";
  private static final String DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  private static final int MAX_UI_LAUNCHES = 2;
  private static final String SHA1_HINT =
    "Google Drive auth failed. Add Play Console → App signing key certificate SHA-1 to the Android OAuth client (package com.dincey.habitjournal). Do not paste a client ID.";

  private ActivityResultLauncher<IntentSenderRequest> googleLauncher;
  private final Handler main = new Handler(Looper.getMainLooper());
  private final ExecutorService io = Executors.newSingleThreadExecutor();
  private boolean interactive = true;
  private int uiLaunches;
  private boolean finished;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    interactive = getIntent() == null || getIntent().getBooleanExtra(EXTRA_INTERACTIVE, true);
    googleLauncher = registerForActivityResult(
      new ActivityResultContracts.StartIntentSenderForResult(),
      this::onGoogleResult
    );
    startAuthorize(false);
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    if (intent != null) tryDeliver(intent, RESULT_OK);
  }

  private AuthorizationRequest buildRequest() {
    return AuthorizationRequest.builder()
      .setRequestedScopes(Arrays.asList(
        new Scope(DRIVE_SCOPE),
        new Scope("email"),
        new Scope("profile"),
        new Scope("openid")
      ))
      .build();
  }

  private void startAuthorize(boolean silentRetry) {
    Identity.getAuthorizationClient(this)
      .authorize(buildRequest())
      .addOnSuccessListener(this, result -> {
        if (finished) return;
        if (!result.hasResolution()) {
          deliverOrFail(result);
          return;
        }
        if (silentRetry || !interactive) {
          fail(uiLaunches > 0 ? SHA1_HINT : "Google Drive needs Connect once");
          return;
        }
        launchResolution(result.getPendingIntent());
      })
      .addOnFailureListener(this, e -> {
        Log.e(TAG, silentRetry ? "silent retry failed" : "authorize failed", e);
        fail(hint(e));
      });
  }

  private void launchResolution(PendingIntent pendingIntent) {
    if (finished) return;
    if (pendingIntent == null) {
      fail("Google authorization UI is unavailable");
      return;
    }
    if (uiLaunches >= MAX_UI_LAUNCHES) {
      fail(SHA1_HINT);
      return;
    }
    uiLaunches++;
    try {
      googleLauncher.launch(new IntentSenderRequest.Builder(pendingIntent).build());
    } catch (Exception e) {
      fail("Could not open Google authorization: " + e.getMessage());
    }
  }

  private void onGoogleResult(ActivityResult activityResult) {
    if (finished) return;
    tryDeliver(activityResult.getData(), activityResult.getResultCode());
  }

  private void tryDeliver(Intent data, int resultCode) {
    if (finished) return;
    if (data != null) {
      try {
        AuthorizationResult parsed = Identity.getAuthorizationClient(this).getAuthorizationResultFromIntent(data);
        if (hasUsableToken(parsed) || parsed.toGoogleSignInAccount() != null) {
          deliverOrFail(parsed);
          return;
        }
        if (parsed.hasResolution() && parsed.getPendingIntent() != null) {
          launchResolution(parsed.getPendingIntent());
          return;
        }
      } catch (Exception e) {
        Log.e(TAG, "getAuthorizationResultFromIntent resultCode=" + resultCode, e);
      }
    }
    main.postDelayed(() -> {
      if (finished || isFinishing() || isDestroyed()) return;
      startAuthorize(true);
    }, 600);
  }

  private boolean hasUsableToken(AuthorizationResult result) {
    String token = result.getAccessToken();
    return token != null && token.length() >= 20;
  }

  private void deliverOrFail(AuthorizationResult result) {
    String email = "";
    GoogleSignInAccount account = null;
    try {
      account = result.toGoogleSignInAccount();
      if (account != null && account.getEmail() != null) email = account.getEmail();
    } catch (Exception ignored) {}

    if (hasUsableToken(result)) {
      ok(result.getAccessToken(), email);
      return;
    }
    if (account != null && account.getAccount() != null) {
      final GoogleSignInAccount acct = account;
      final String emailFinal = email;
      io.execute(() -> {
        try {
          String recovered = GoogleAuthUtil.getToken(this, acct.getAccount(), "oauth2:" + DRIVE_SCOPE);
          runOnUiThread(() -> {
            if (recovered != null && recovered.length() >= 20) ok(recovered, emailFinal);
            else fail("Google did not return an access token");
          });
        } catch (Exception e) {
          Log.e(TAG, "GoogleAuthUtil.getToken failed", e);
          runOnUiThread(() -> fail(hint(e)));
        }
      });
      return;
    }
    fail("Google did not return an access token");
  }

  private void ok(String token, String email) {
    if (finished) return;
    finished = true;
    DriveAuthPlugin.completeOk(token, email);
    bringAppBack();
  }

  private void fail(String message) {
    if (finished) return;
    finished = true;
    DriveAuthPlugin.completeError(message == null ? "Google Drive authorization failed" : message);
    bringAppBack();
  }

  private void bringAppBack() {
    Intent home = new Intent(this, MainActivity.class);
    home.addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK
        | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        | Intent.FLAG_ACTIVITY_SINGLE_TOP
        | Intent.FLAG_ACTIVITY_CLEAR_TOP
    );
    startActivity(home);
    finish();
  }

  private String hint(Exception e) {
    Throwable t = e;
    if (e.getCause() instanceof ApiException) t = e.getCause();
    if (t instanceof ApiException) {
      int code = ((ApiException) t).getStatusCode();
      if (code == CommonStatusCodes.DEVELOPER_ERROR) return SHA1_HINT;
    }
    String msg = t.getMessage() == null ? (e.getMessage() == null ? "" : e.getMessage()) : t.getMessage();
    String lower = msg.toLowerCase();
    if (lower.contains("invalid_client") || lower.contains("generaloauthflow") || lower.contains("oauth client was not found")
        || lower.contains("developer") || lower.contains("[10]") || lower.contains("not set up correctly")
        || lower.contains("current app identifier")) {
      return SHA1_HINT;
    }
    if (msg.isEmpty()) return "Google Drive authorization failed";
    return msg;
  }
}
