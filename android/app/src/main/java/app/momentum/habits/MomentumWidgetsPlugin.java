package app.momentum.habits;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import app.momentum.habits.widgets.WidgetStore;

@CapacitorPlugin(name = "MomentumWidgets")
public class MomentumWidgetsPlugin extends Plugin {
  @PluginMethod
  public void update(PluginCall call) {
    try {
      if (call.getData() != null && call.getData().length() > 0) {
        WidgetStore.writeSnapshot(getContext(), new JSONObject(call.getData().toString()));
      }
    } catch (Exception ignored) {}
    WidgetStore.refreshAll(getContext());
    call.resolve();
  }

  @PluginMethod
  public void refresh(PluginCall call) {
    WidgetStore.refreshAll(getContext());
    call.resolve();
  }
}
