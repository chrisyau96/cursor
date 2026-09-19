package com.dincey.habitjournal;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS bridge for Drive backup auth. Google UI runs in DriveConsentActivity on
 * a separate task. startActivityForResult into singleTask MainActivity always
 * cancelled after the account picker (Connect "did not finish" loop).
 */
@CapacitorPlugin(name = "DriveAuth")
public class DriveAuthPlugin extends Plugin {
  public static final int REQUEST_AUTHORIZE = 42801;
  private static final String TAG = "DriveAuth";

  private static final Object lock = new Object();
  private static DriveAuthPlugin active;
  private static PluginCall pendingCall;

  @Override
  public void load() {
    super.load();
    active = this;
  }

  @PluginMethod
  public void authorize(PluginCall call) {
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Google Drive auth needs the app in the foreground", "AUTH_FAILED");
      return;
    }
    boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", true));
    call.setKeepAlive(true);
    if (getBridge() != null) getBridge().saveCall(call);
    synchronized (lock) {
      active = this;
      pendingCall = call;
    }
    activity.runOnUiThread(() -> {
      Intent intent = new Intent(activity, DriveConsentActivity.class);
      intent.putExtra(DriveConsentActivity.EXTRA_INTERACTIVE, interactive);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
      activity.startActivity(intent);
    });
  }

  public void handleAuthorizationIntent(int requestCode, int resultCode, Intent data) {
    // Google result is delivered via completeOk/completeError, not onActivityResult.
  }

  static void completeOk(String token, String email) {
    DriveAuthPlugin plugin;
    PluginCall call;
    synchronized (lock) {
      plugin = active;
      call = pendingCall;
      pendingCall = null;
    }
    if (plugin == null || call == null) {
      Log.w(TAG, "completeOk with no pending Connect call");
      return;
    }
    Runnable done = () -> {
      JSObject ret = new JSObject();
      ret.put("accessToken", token);
      ret.put("email", email == null ? "" : email);
      call.setKeepAlive(false);
      call.resolve(ret);
    };
    Activity activity = plugin.getActivity();
    if (activity != null) activity.runOnUiThread(done);
    else done.run();
  }

  static void completeError(String message) {
    DriveAuthPlugin plugin;
    PluginCall call;
    synchronized (lock) {
      plugin = active;
      call = pendingCall;
      pendingCall = null;
    }
    if (plugin == null || call == null) {
      Log.w(TAG, "completeError with no pending Connect call: " + message);
      return;
    }
    String msg = message == null || message.isEmpty() ? "Google Drive authorization failed" : message;
    Runnable done = () -> call.reject(msg, "AUTH_FAILED");
    Activity activity = plugin.getActivity();
    if (activity != null) activity.runOnUiThread(done);
    else done.run();
  }
}
