package com.dincey.habitjournal;

import android.app.Activity;
import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS bridge for Drive backup auth. The Google UI runs in DriveConsentActivity
 * (standard launchMode) because MainActivity is singleTask and drops the
 * AuthorizationClient result after the account picker.
 */
@CapacitorPlugin(name = "DriveAuth")
public class DriveAuthPlugin extends Plugin {
  public static final int REQUEST_AUTHORIZE = 42801;

  private final Object lock = new Object();
  private PluginCall pendingCall;

  @PluginMethod
  public void authorize(PluginCall call) {
    Activity activity = getActivity();
    if (!(activity instanceof MainActivity)) {
      call.reject("Google Drive auth needs the app in the foreground", "AUTH_FAILED");
      return;
    }
    boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", true));
    call.setKeepAlive(true);
    if (getBridge() != null) getBridge().saveCall(call);
    synchronized (lock) {
      pendingCall = call;
    }
    activity.runOnUiThread(() -> ((MainActivity) activity).launchDriveConsent(interactive));
  }

  public void handleAuthorizationIntent(int requestCode, int resultCode, Intent data) {
    if (requestCode != REQUEST_AUTHORIZE) return;
    onConsentActivityResult(resultCode, data);
  }

  public void onConsentActivityResult(int resultCode, Intent data) {
    PluginCall call = takePending();
    if (call == null) return;
    if (data != null) {
      String token = data.getStringExtra(DriveConsentActivity.EXTRA_ACCESS_TOKEN);
      if (token != null && token.length() >= 20) {
        JSObject ret = new JSObject();
        ret.put("accessToken", token);
        String email = data.getStringExtra(DriveConsentActivity.EXTRA_EMAIL);
        ret.put("email", email == null ? "" : email);
        call.setKeepAlive(false);
        call.resolve(ret);
        return;
      }
      String err = data.getStringExtra(DriveConsentActivity.EXTRA_ERROR);
      if (err != null && !err.isEmpty()) {
        call.reject(err, resultCode == Activity.RESULT_CANCELED ? "USER_CANCELED" : "AUTH_FAILED");
        return;
      }
    }
    if (resultCode == Activity.RESULT_CANCELED) {
      call.reject("Google Drive sign-in did not finish. Tap Connect again and pick your Google account once.", "USER_CANCELED");
      return;
    }
    call.reject("Google did not return an access token", "AUTH_FAILED");
  }

  private PluginCall takePending() {
    synchronized (lock) {
      PluginCall call = pendingCall;
      pendingCall = null;
      return call;
    }
  }
}
