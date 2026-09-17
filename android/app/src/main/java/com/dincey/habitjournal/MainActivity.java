package com.dincey.habitjournal;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

// Capgo SocialLogin requires this interface before Google Drive scopes can be requested.
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(MomentumWidgetsPlugin.class);
    registerPlugin(DriveAuthPlugin.class);
    super.onCreate(savedInstanceState);
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
}
