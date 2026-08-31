package app.momentum.habits.widgets;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONArray;
import org.json.JSONObject;

public class WidgetActionReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    String type = intent.getStringExtra("type");
    String habitId = intent.getStringExtra("habitId");
    String date = intent.getStringExtra("date");
    if (type == null) return;
    WidgetStore.enqueue(context, type, habitId, date);
    if ("complete".equals(type) || "reset".equals(type)) {
      JSONObject snap = WidgetStore.readSnapshot(context);
      bump(snap.optJSONArray("outstanding"), habitId, "complete".equals(type));
      WidgetStore.writeSnapshot(context, snap);
    }
    WidgetStore.refreshAll(context);
    try {
      Intent open = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(
        "momentum://widget/" + type + (habitId != null ? ("?habitId=" + habitId) : "")
      ));
      open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      context.startActivity(open);
    } catch (Exception ignored) {}
  }

  private void bump(JSONArray items, String habitId, boolean complete) {
    if (items == null || habitId == null) return;
    for (int i = 0; i < items.length(); i++) {
      JSONObject h = items.optJSONObject(i);
      if (h == null || !habitId.equals(h.optString("id"))) continue;
      int count = h.optInt("count");
      int target = Math.max(1, h.optInt("target"));
      try {
        if (complete) {
          count = Math.min(target, count + 1);
          h.put("count", count);
          h.put("done", count >= target);
        } else {
          h.put("count", 0);
          h.put("done", false);
        }
      } catch (Exception ignored) {}
    }
  }
}
