package com.dincey.habitjournal;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentSender;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Drive backup auth via Google Identity AuthorizationClient.
 * Capgo SocialLogin hits Credential Manager first ([16] Account reauth failed).
 * MainActivity.singleTask also drops startIntentSenderForResult, which we used
 * to report as "Google sign-in cancelled" after the user picked an account.
 * Results now come through Activity Result API, then a silent authorize retry.
 */
@CapacitorPlugin(name = "DriveAuth")
public class DriveAuthPlugin extends Plugin {
  public static final int REQUEST_AUTHORIZE = 42801;
  private static final String TAG = "DriveAuth";
  private static final String DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  private static final String SHA1_HINT =
    "Google Drive auth failed. Add Play Console → App signing → SHA-1 to the Android OAuth client (package com.dincey.habitjournal). Do not paste the Android client ID.";

  private final Object lock = new Object();
  private PluginCall pendingCall;
  private final ExecutorService io = Executors.newSingleThreadExecutor();

  @PluginMethod
  public void authorize(PluginCall call) {
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Google Drive auth needs the app in the foreground", "AUTH_FAILED");
      return;
    }
    activity.runOnUiThread(() -> startAuthorize(call, activity, false));
  }

  public void handleAuthorizationIntent(int requestCode, int resultCode, Intent data) {
    if (requestCode != REQUEST_AUTHORIZE) return;
    onAuthorizeActivityResult(resultCode, data);
  }

  public void onAuthorizeActivityResult(int resultCode, Intent data) {
    PluginCall call = takePending();
    if (call == null) return;
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Google Drive auth needs the app in the foreground", "AUTH_FAILED");
      return;
    }
    if (data != null) {
      try {
        AuthorizationResult parsed = Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data);
        if (hasUsableToken(parsed) || parsed.toGoogleSignInAccount() != null) {
          deliver(call, parsed);
          return;
        }
      } catch (Exception e) {
        Log.e(TAG, "getAuthorizationResultFromIntent resultCode=" + resultCode, e);
      }
    }
    // singleTask often returns RESULT_CANCELED after a successful account pick.
    // Ask Google again without UI; the grant is often already stored.
    startAuthorize(call, activity, true);
  }

  private void startAuthorize(PluginCall call, Activity activity, boolean silentRetry) {
    AuthorizationRequest request = AuthorizationRequest.builder()
      .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_SCOPE)))
      .build();
    boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", true));
    Identity.getAuthorizationClient(activity)
      .authorize(request)
      .addOnSuccessListener(activity, result -> {
        if (!result.hasResolution()) {
          deliver(call, result);
          return;
        }
        if (silentRetry || !interactive) {
          if (!interactive) {
            call.reject("Google Drive needs Connect once", "AUTH_FAILED");
            return;
          }
          call.reject("Google sign-in cancelled", "USER_CANCELED");
          return;
        }
        PendingIntent pendingIntent = result.getPendingIntent();
        if (pendingIntent == null) {
          call.reject("Google authorization UI is unavailable", "AUTH_FAILED");
          return;
        }
        call.setKeepAlive(true);
        if (getBridge() != null) getBridge().saveCall(call);
        synchronized (lock) {
          pendingCall = call;
        }
        try {
          if (activity instanceof MainActivity) {
            ((MainActivity) activity).launchDriveAuth(pendingIntent);
          } else {
            activity.startIntentSenderForResult(
              pendingIntent.getIntentSender(),
              REQUEST_AUTHORIZE,
              null,
              0,
              0,
              0,
              null
            );
          }
        } catch (Exception e) {
          takePending();
          call.reject("Could not open Google authorization: " + e.getMessage(), "AUTH_FAILED");
        }
      })
      .addOnFailureListener(activity, e -> {
        Log.e(TAG, silentRetry ? "silent retry failed" : "authorize failed", e);
        call.reject(hint(e), "AUTH_FAILED");
      });
  }

  private boolean hasUsableToken(AuthorizationResult result) {
    String token = result.getAccessToken();
    return token != null && token.length() >= 20;
  }

  private void deliver(PluginCall call, AuthorizationResult result) {
    String token = result.getAccessToken();
    String email = "";
    GoogleSignInAccount account = null;
    try {
      account = result.toGoogleSignInAccount();
      if (account != null && account.getEmail() != null) email = account.getEmail();
    } catch (Exception ignored) {}

    if (hasUsableToken(result)) {
      finishOk(call, token, email);
      return;
    }

    if (account != null && account.getAccount() != null) {
      final GoogleSignInAccount acct = account;
      final String emailFinal = email;
      io.execute(() -> {
        try {
          String scoped = "oauth2:" + DRIVE_SCOPE;
          String recovered = GoogleAuthUtil.getToken(getContext(), acct.getAccount(), scoped);
          if (recovered != null && recovered.length() >= 20) {
            finishOk(call, recovered, emailFinal);
            return;
          }
          call.reject("Google did not return an access token", "AUTH_FAILED");
        } catch (Exception e) {
          Log.e(TAG, "GoogleAuthUtil.getToken failed", e);
          call.reject(hint(e), "AUTH_FAILED");
        }
      });
      return;
    }
    call.reject("Google did not return an access token", "AUTH_FAILED");
  }

  private void finishOk(PluginCall call, String token, String email) {
    JSObject ret = new JSObject();
    ret.put("accessToken", token);
    ret.put("email", email == null ? "" : email);
    call.setKeepAlive(false);
    call.resolve(ret);
  }

  private PluginCall takePending() {
    synchronized (lock) {
      PluginCall call = pendingCall;
      pendingCall = null;
      return call;
    }
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
    if (lower.contains("developer") || lower.contains("[10]") || lower.contains("not set up correctly")
        || lower.contains("current app identifier")) {
      return SHA1_HINT;
    }
    if (msg.isEmpty()) return "Google Drive authorization failed";
    return msg;
  }
}
