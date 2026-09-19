package com.dincey.habitjournal;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Build;
import android.util.Log;
import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.UserRecoverableAuthException;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Scope;
import java.security.MessageDigest;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Drive Connect uses one GoogleSignIn.getSignInIntent() plus GoogleAuthUtil.getToken.
 * AuthorizationClient's PendingIntent was cancelled by singleTask task reordering;
 * 63.0.8 then re-opened that picker three times from resume retries.
 */
@SuppressWarnings("deprecation")
public final class DriveAuthorizer {
  private static final String TAG = "DriveAuth";
  private static final String DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  private static final Scope DRIVE = new Scope(DRIVE_SCOPE);

  private final ComponentActivity activity;
  private final ActivityResultLauncher<Intent> launcher;
  private final ExecutorService io = Executors.newSingleThreadExecutor();

  private GoogleSignInClient client;
  private boolean interactive = true;
  private boolean finished;
  private boolean launchedUi;
  private boolean recovering;
  private GoogleSignInAccount pendingAccount;

  public DriveAuthorizer(ComponentActivity activity) {
    this.activity = activity;
    this.launcher = activity.registerForActivityResult(
      new ActivityResultContracts.StartActivityForResult(),
      this::onActivityResult
    );
  }

  public void start(boolean interactive) {
    this.interactive = interactive;
    this.finished = false;
    this.launchedUi = false;
    this.recovering = false;
    this.pendingAccount = null;
    this.client = GoogleSignIn.getClient(activity, new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
      .requestEmail()
      .requestScopes(DRIVE)
      .build());
    Log.i(TAG, "install SHA-1 " + installSha1s());

    if (!interactive) {
      GoogleSignInAccount last = GoogleSignIn.getLastSignedInAccount(activity);
      if (last != null && last.getGrantedScopes().contains(DRIVE)) {
        fetchToken(last);
        return;
      }
      client.silentSignIn()
        .addOnSuccessListener(activity, this::fetchToken)
        .addOnFailureListener(activity, e -> fail("Google Drive needs Connect once"));
      return;
    }

    // Interactive Connect: one account picker. Do not silent-retry or re-open
    // Google UI from onResume — that is what showed the picker three times.
    client.signOut().addOnCompleteListener(activity, t -> launchSignInOnce());
  }

  public void shutdown() {
    io.shutdownNow();
  }

  private void launchSignInOnce() {
    if (finished || launchedUi) return;
    launchedUi = true;
    recovering = false;
    try {
      launcher.launch(client.getSignInIntent());
    } catch (Exception e) {
      fail("Could not open Google sign-in: " + e.getMessage());
    }
  }

  private void onActivityResult(ActivityResult result) {
    if (finished) return;
    if (recovering) {
      recovering = false;
      if (result.getResultCode() == Activity.RESULT_OK && pendingAccount != null) {
        fetchToken(pendingAccount);
        return;
      }
      fail("Google Drive sign-in was cancelled");
      return;
    }
    if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
      fail("Google Drive sign-in was cancelled");
      return;
    }
    try {
      GoogleSignInAccount account = GoogleSignIn.getSignedInAccountFromIntent(result.getData())
        .getResult(ApiException.class);
      fetchToken(account);
    } catch (ApiException e) {
      Log.e(TAG, "GoogleSignIn failed status=" + e.getStatusCode(), e);
      if (e.getStatusCode() == GoogleSignInStatusCodes.SIGN_IN_CANCELLED) {
        fail("Google Drive sign-in was cancelled");
        return;
      }
      if (e.getStatusCode() == GoogleSignInStatusCodes.SIGN_IN_CURRENTLY_IN_PROGRESS) {
        fail("Google Drive sign-in is already open");
        return;
      }
      fail(hint(e));
    }
  }

  private void fetchToken(GoogleSignInAccount account) {
    if (finished) return;
    if (account == null || account.getAccount() == null) {
      fail("Google did not return an account");
      return;
    }
    pendingAccount = account;
    final String email = account.getEmail() == null ? "" : account.getEmail();
    io.execute(() -> {
      try {
        String token = GoogleAuthUtil.getToken(activity, account.getAccount(), "oauth2:" + DRIVE_SCOPE);
        activity.runOnUiThread(() -> {
          if (token != null && token.length() >= 20) ok(token, email);
          else fail("Google did not return an access token");
        });
      } catch (UserRecoverableAuthException e) {
        Log.i(TAG, "Drive scope needs a one-time consent UI");
        Intent recover = e.getIntent();
        activity.runOnUiThread(() -> {
          if (finished) return;
          if (!interactive || recover == null) {
            fail("Google Drive needs Connect once");
            return;
          }
          if (recovering) return;
          recovering = true;
          try {
            launcher.launch(recover);
          } catch (Exception launchErr) {
            fail("Could not open Google Drive consent: " + launchErr.getMessage());
          }
        });
      } catch (Exception e) {
        Log.e(TAG, "GoogleAuthUtil.getToken failed", e);
        activity.runOnUiThread(() -> fail(hint(e)));
      }
    });
  }

  private void ok(String token, String email) {
    if (finished) return;
    finished = true;
    DriveAuthPlugin.completeOk(token, email);
  }

  private void fail(String message) {
    if (finished) return;
    finished = true;
    DriveAuthPlugin.completeError(message == null ? "Google Drive authorization failed" : message);
  }

  private String hint(Exception e) {
    Throwable t = e;
    if (e.getCause() instanceof ApiException) t = e.getCause();
    if (t instanceof ApiException) {
      int code = ((ApiException) t).getStatusCode();
      if (code == CommonStatusCodes.DEVELOPER_ERROR || code == GoogleSignInStatusCodes.DEVELOPER_ERROR) {
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
        PackageInfo pi = activity.getPackageManager().getPackageInfo(
          activity.getPackageName(),
          PackageManager.GET_SIGNING_CERTIFICATES
        );
        SigningInfo info = pi.signingInfo;
        if (info != null) {
          addSha1s(out, info.getApkContentsSigners());
          addSha1s(out, info.getSigningCertificateHistory());
        }
      } else {
        @SuppressWarnings("deprecation")
        PackageInfo pi = activity.getPackageManager().getPackageInfo(
          activity.getPackageName(),
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
