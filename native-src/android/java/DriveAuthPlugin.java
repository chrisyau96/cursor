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
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Drive backup auth via Google Identity AuthorizationClient only.
 * Capgo SocialLogin always hits Credential Manager first, which throws
 * "[16] Account reauth failed" on Play-signed builds. This plugin skips that.
 */
@CapacitorPlugin(name = "DriveAuth")
public class DriveAuthPlugin extends Plugin {
  public static final int REQUEST_AUTHORIZE = 42801;
  private static final String TAG = "DriveAuth";
  private static final String DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  private static final String EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
  private static final String SHA1_HINT =
    "Google Drive auth failed. Add Play Console → App signing → SHA-1 to the Android OAuth client (package com.dincey.habitjournal). Do not paste the Android client ID.";

  private final Object lock = new Object();
  private PluginCall pendingCall;
  private final ExecutorService io = Executors.newSingleThreadExecutor();

  @PluginMethod
  public void authorize(PluginCall call) {
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Google Drive auth needs the app in the foreground");
      return;
    }
    activity.runOnUiThread(() -> startAuthorize(call, activity));
  }

  public void handleAuthorizationIntent(int requestCode, int resultCode, Intent data) {
    if (requestCode != REQUEST_AUTHORIZE) return;
    PluginCall call = takePending();
    if (call == null) return;
    if (resultCode != Activity.RESULT_OK || data == null) {
      call.reject("Google sign-in cancelled");
      return;
    }
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Google Drive auth needs the app in the foreground");
      return;
    }
    try {
      AuthorizationResult result = Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data);
      deliver(call, result);
    } catch (ApiException e) {
      Log.e(TAG, "getAuthorizationResultFromIntent", e);
      call.reject(hint(e));
    } catch (Exception e) {
      Log.e(TAG, "authorization intent failed", e);
      call.reject(hint(e));
    }
  }

  private void startAuthorize(PluginCall call, Activity activity) {
    synchronized (lock) {
      if (pendingCall != null) {
        call.reject("Google Drive sign-in is already in progress");
        return;
      }
    }
    boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", true));
    List<Scope> scopes = new ArrayList<>();
    scopes.add(new Scope(DRIVE_SCOPE));
    scopes.add(new Scope(EMAIL_SCOPE));
    AuthorizationRequest request = AuthorizationRequest.builder().setRequestedScopes(scopes).build();
    Identity.getAuthorizationClient(activity)
      .authorize(request)
      .addOnSuccessListener(activity, result -> {
        if (result.hasResolution()) {
          if (!interactive) {
            call.reject("Google Drive needs Connect once");
            return;
          }
          PendingIntent pendingIntent = result.getPendingIntent();
          if (pendingIntent == null) {
            call.reject("Google authorization UI is unavailable");
            return;
          }
          call.setKeepAlive(true);
          if (getBridge() != null) getBridge().saveCall(call);
          synchronized (lock) {
            pendingCall = call;
          }
          try {
            activity.startIntentSenderForResult(
              pendingIntent.getIntentSender(),
              REQUEST_AUTHORIZE,
              null,
              0,
              0,
              0,
              null
            );
          } catch (IntentSender.SendIntentException e) {
            takePending();
            call.reject("Could not open Google authorization: " + e.getMessage());
          }
          return;
        }
        deliver(call, result);
      })
      .addOnFailureListener(activity, e -> {
        Log.e(TAG, "authorize failed", e);
        call.reject(hint(e));
      });
  }

  private void deliver(PluginCall call, AuthorizationResult result) {
    String token = result.getAccessToken();
    String email = "";
    GoogleSignInAccount account = null;
    try {
      account = result.toGoogleSignInAccount();
      if (account != null && account.getEmail() != null) email = account.getEmail();
    } catch (Exception ignored) {}

    if (token != null && token.length() >= 20) {
      finishOk(call, token, email);
      return;
    }

    if (account != null && account.getAccount() != null) {
      final GoogleSignInAccount acct = account;
      final String emailFinal = email;
      io.execute(() -> {
        try {
          String scoped = "oauth2:" + DRIVE_SCOPE + " " + EMAIL_SCOPE;
          String recovered = GoogleAuthUtil.getToken(getContext(), acct.getAccount(), scoped);
          if (recovered != null && recovered.length() >= 20) {
            finishOk(call, recovered, emailFinal);
            return;
          }
          call.reject("Google did not return an access token");
        } catch (Exception e) {
          Log.e(TAG, "GoogleAuthUtil.getToken failed", e);
          call.reject(hint(e));
        }
      });
      return;
    }
    call.reject("Google did not return an access token");
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
      if (code == CommonStatusCodes.CANCELED) return "Google sign-in cancelled";
      if (code == CommonStatusCodes.DEVELOPER_ERROR) return SHA1_HINT;
    }
    String msg = t.getMessage() == null ? (e.getMessage() == null ? "" : e.getMessage()) : t.getMessage();
    String lower = msg.toLowerCase();
    if (lower.contains("cancel")) return "Google sign-in cancelled";
    if (lower.contains("developer") || lower.contains("[10]") || lower.contains("not set up correctly")
        || lower.contains("current app identifier")) {
      return SHA1_HINT;
    }
    if (msg.isEmpty()) return "Google Drive authorization failed";
    return msg;
  }
}
