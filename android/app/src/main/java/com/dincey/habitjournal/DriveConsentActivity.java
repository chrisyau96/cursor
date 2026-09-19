package com.dincey.habitjournal;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Build;
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
import java.security.MessageDigest;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Hosts Google AuthorizationClient on its own task (taskAffinity).
 * MainActivity is singleTask, so this helper must NOT be singleTask and must
 * not be started for-result from MainActivity. Google's picker result is
 * posted back through DriveAuthPlugin.completeOk/completeError.
 */
public class DriveConsentActivity extends ComponentActivity {
  public static final String EXTRA_INTERACTIVE = "interactive";

  private static final String TAG = "DriveAuth";
  private static final String DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  private static final int MAX_UI_LAUNCHES = 3;

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
    Log.i(TAG, "install SHA-1 " + installSha1s());
    startAuthorize(true);
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    if (intent != null) tryDeliver(intent, RESULT_OK);
  }

  @Override
  protected void onDestroy() {
    io.shutdownNow();
    super.onDestroy();
  }

  private AuthorizationRequest buildRequest() {
    return AuthorizationRequest.builder()
      .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_SCOPE)))
      .build();
  }

  private void startAuthorize(boolean allowUi) {
    Identity.getAuthorizationClient(this)
      .authorize(buildRequest())
      .addOnSuccessListener(this, result -> {
        if (finished) return;
        if (!result.hasResolution()) {
          deliverOrFail(result);
          return;
        }
        if (!allowUi || !interactive) {
          fail(uiLaunches > 0
            ? "Google Drive sign-in did not finish"
            : "Google Drive needs Connect once");
          return;
        }
        launchResolution(result.getPendingIntent());
      })
      .addOnFailureListener(this, e -> {
        Log.e(TAG, "authorize failed", e);
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
      fail("Google Drive sign-in did not finish");
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
        if (isDeveloperError(e)) {
          fail(hint(e));
          return;
        }
      }
    }
    if (resultCode == RESULT_CANCELED) {
      fail("Google Drive sign-in was cancelled");
      return;
    }
    main.postDelayed(() -> {
      if (finished || isFinishing() || isDestroyed()) return;
      startAuthorize(interactive);
    }, 400);
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

  private boolean isDeveloperError(Exception e) {
    Throwable t = e;
    if (e.getCause() instanceof ApiException) t = e.getCause();
    return t instanceof ApiException
      && ((ApiException) t).getStatusCode() == CommonStatusCodes.DEVELOPER_ERROR;
  }

  private String hint(Exception e) {
    Throwable t = e;
    if (e.getCause() instanceof ApiException) t = e.getCause();
    if (t instanceof ApiException) {
      int code = ((ApiException) t).getStatusCode();
      if (code == CommonStatusCodes.DEVELOPER_ERROR) {
        return "Google rejected this install (error 10). This phone's SHA-1: "
          + installSha1s()
          + ". Create an Android OAuth client with package com.dincey.habitjournal and that exact value. Quantum-ready Play signing needs a separate client for Classical SHA-1 and Post-quantum SHA-1. Do not paste a client ID.";
      }
      String status = t.getMessage() == null ? "" : t.getMessage();
      if (!status.isEmpty()) return status;
      return "Google Drive authorization failed (status " + code + ")";
    }
    String msg = t.getMessage() == null ? (e.getMessage() == null ? "" : e.getMessage()) : t.getMessage();
    if (msg.isEmpty()) return "Google Drive authorization failed";
    return msg;
  }

  private String installSha1s() {
    Set<String> out = new LinkedHashSet<>();
    try {
      if (Build.VERSION.SDK_INT >= 28) {
        PackageInfo pi = getPackageManager().getPackageInfo(
          getPackageName(),
          PackageManager.GET_SIGNING_CERTIFICATES
        );
        SigningInfo info = pi.signingInfo;
        if (info != null) {
          addSha1s(out, info.getApkContentsSigners());
          addSha1s(out, info.getSigningCertificateHistory());
        }
      } else {
        @SuppressWarnings("deprecation")
        PackageInfo pi = getPackageManager().getPackageInfo(
          getPackageName(),
          PackageManager.GET_SIGNATURES
        );
        @SuppressWarnings("deprecation")
        Signature[] sigs = pi.signatures;
        addSha1s(out, sigs);
      }
    } catch (Exception e) {
      Log.w(TAG, "could not read signing certs", e);
    }
    if (out.isEmpty()) return "(unknown)";
    return String.join("  ", out);
  }

  private static void addSha1s(Set<String> out, Signature[] sigs) {
    if (sigs == null) return;
    for (Signature sig : sigs) {
      if (sig == null) continue;
      try {
        MessageDigest md = MessageDigest.getInstance("SHA-1");
        byte[] digest = md.digest(sig.toByteArray());
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < digest.length; i++) {
          if (i > 0) sb.append(':');
          sb.append(String.format("%02X", digest[i] & 0xff));
        }
        out.add(sb.toString());
      } catch (Exception ignored) {}
    }
  }
}
