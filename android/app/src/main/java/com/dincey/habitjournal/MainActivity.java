package com.dincey.habitjournal;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import java.io.File;

// Capgo SocialLogin requires this interface before Google Drive scopes can be requested.
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
  private static final String WEB_PREFS = "momentum_web";
  private static final String PURGED_VERSION = "purgedVersionCode";
  private ActivityResultLauncher<IntentSenderRequest> driveAuthLauncher;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(MomentumWidgetsPlugin.class);
    registerPlugin(DriveAuthPlugin.class);
    // Must register before super.onCreate. singleTask drops startIntentSenderForResult.
    driveAuthLauncher = registerForActivityResult(
      new ActivityResultContracts.StartIntentSenderForResult(),
      result -> {
        if (getBridge() == null) return;
        PluginHandle pluginHandle = getBridge().getPlugin("DriveAuth");
        if (pluginHandle == null || !(pluginHandle.getInstance() instanceof DriveAuthPlugin)) return;
        ((DriveAuthPlugin) pluginHandle.getInstance()).onAuthorizeActivityResult(result.getResultCode(), result.getData());
      }
    );
    purgeStaleWebViewCaches();
    super.onCreate(savedInstanceState);
  }

  public void launchDriveAuth(PendingIntent pendingIntent) {
    driveAuthLauncher.launch(new IntentSenderRequest.Builder(pendingIntent).build());
  }

  @Override
  public void onStart() {
    super.onStart();
    if (getBridge() == null) return;
    WebView webView = getBridge().getWebView();
    if (webView == null) return;
    webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
    webView.clearCache(true);
  }

  @Override
  public void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == DriveAuthPlugin.REQUEST_AUTHORIZE) {
      PluginHandle pluginHandle = getBridge().getPlugin("DriveAuth");
      if (pluginHandle == null) {
        Log.i("DriveAuth", "plugin handle is null");
        return;
      }
      Plugin plugin = pluginHandle.getInstance();
      if (!(plugin instanceof DriveAuthPlugin)) {
        Log.i("DriveAuth", "plugin instance is not DriveAuthPlugin");
        return;
      }
      ((DriveAuthPlugin) plugin).handleAuthorizationIntent(requestCode, resultCode, data);
      return;
    }
    if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
        && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
      PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
      if (pluginHandle == null) {
        Log.i("Google Activity Result", "SocialLogin login handle is null");
        return;
      }
      Plugin plugin = pluginHandle.getInstance();
      if (!(plugin instanceof SocialLoginPlugin)) {
        Log.i("Google Activity Result", "SocialLogin plugin instance is not SocialLoginPlugin");
        return;
      }
      ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }
  }

  // Capgo marker method — required, leave empty.
  @Override
  public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}

  private void purgeStaleWebViewCaches() {
    try {
      PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
      int code = info.versionCode;
      SharedPreferences prefs = getSharedPreferences(WEB_PREFS, MODE_PRIVATE);
      if (prefs.getInt(PURGED_VERSION, -1) == code) return;
      File dataDir = getApplicationContext().getDataDir();
      wipeWebViewCaches(new File(dataDir, "app_webview"));
      wipeWebViewCaches(new File(dataDir, "cache"));
      prefs.edit().putInt(PURGED_VERSION, code).apply();
      Log.i("DriveAuth", "Purged WebView caches for versionCode " + code);
    } catch (Exception e) {
      Log.w("DriveAuth", "Could not purge WebView caches", e);
    }
  }

  private void wipeWebViewCaches(File dir) {
    if (dir == null || !dir.exists()) return;
    File[] kids = dir.listFiles();
    if (kids == null) return;
    for (File f : kids) {
      String n = f.getName();
      if (isAppDataDir(n)) continue;
      if (shouldWipeWebCache(n)) {
        deleteRecursively(f);
      } else if (f.isDirectory()) {
        wipeWebViewCaches(f);
      }
    }
  }

  private boolean isAppDataDir(String n) {
    return n.equalsIgnoreCase("Local Storage")
        || n.equalsIgnoreCase("IndexedDB")
        || n.equals("databases")
        || n.equalsIgnoreCase("WebStorage");
  }

  private boolean shouldWipeWebCache(String n) {
    String lower = n.toLowerCase();
    return lower.contains("service worker")
        || lower.contains("cachestorage")
        || lower.equals("cache")
        || lower.equals("code cache")
        || lower.equals("gpucache");
  }

  private void deleteRecursively(File f) {
    if (f == null || !f.exists()) return;
    if (f.isDirectory()) {
      File[] kids = f.listFiles();
      if (kids != null) {
        for (File k : kids) deleteRecursively(k);
      }
    }
    if (!f.delete()) Log.w("DriveAuth", "Could not delete " + f.getAbsolutePath());
  }
}
