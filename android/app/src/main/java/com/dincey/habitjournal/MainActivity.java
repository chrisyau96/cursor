package com.dincey.habitjournal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(MomentumWidgetsPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
