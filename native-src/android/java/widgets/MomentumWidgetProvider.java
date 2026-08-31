package app.momentum.habits.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import app.momentum.habits.R;

public class MomentumWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    JSONObject snap = WidgetStore.readSnapshot(context);
    String mode = snap.optString("mode", "today");
    for (int id : appWidgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_momentum);
      bind(context, views, snap, mode);
      manager.updateAppWidget(id, views);
    }
  }

  private void bind(Context ctx, RemoteViews views, JSONObject snap, String mode) {
    views.setViewVisibility(R.id.widget_list, View.GONE);
    views.setViewVisibility(R.id.widget_stat, View.GONE);
    if ("streak".equals(mode)) {
      JSONObject streak = snap.optJSONObject("streak");
      int cur = streak != null ? streak.optInt("current") : 0;
      int best = streak != null ? streak.optInt("best") : 0;
      showStat(ctx, views, "Streak", String.valueOf(cur), "Best " + best, "momentum://widget/open");
    } else if ("credits".equals(mode)) {
      showStat(ctx, views, "Credits", "HK$" + snap.optInt("credits"), "Available", "momentum://widget/open");
    } else if ("gift".equals(mode)) {
      JSONObject gift = snap.optJSONObject("gift");
      if (gift == null) showStat(ctx, views, "Gift", "—", "No gift goal", "momentum://widget/open");
      else showStat(ctx, views, gift.optString("icon") + " " + gift.optString("label"),
        gift.optInt("current") + "/" + gift.optInt("target"), "Next gift", "momentum://widget/open");
    } else if ("journal".equals(mode)) {
      boolean done = snap.optJSONObject("journal") != null && snap.optJSONObject("journal").optBoolean("done");
      showStat(ctx, views, "Journal", done ? "✓" : "✎", done ? "Logged today" : "Tap to log", "momentum://widget/journal");
    } else if ("habits".equals(mode)) {
      views.setViewVisibility(R.id.widget_list, View.VISIBLE);
      views.setTextViewText(R.id.widget_title, "Habits due");
      fillList(ctx, views, snap.optJSONArray("habits"), false);
    } else {
      views.setViewVisibility(R.id.widget_list, View.VISIBLE);
      views.setTextViewText(R.id.widget_title, "Today");
      fillList(ctx, views, snap.optJSONArray("outstanding"), true);
    }
  }

  private void showStat(Context ctx, RemoteViews views, String kicker, String big, String sub, String url) {
    views.setViewVisibility(R.id.widget_stat, View.VISIBLE);
    views.setTextViewText(R.id.widget_kicker, kicker);
    views.setTextViewText(R.id.widget_big, big);
    views.setTextViewText(R.id.widget_sub, sub);
    views.setOnClickPendingIntent(R.id.widget_root, open(ctx, url));
  }

  private void fillList(Context ctx, RemoteViews views, JSONArray items, boolean actions) {
    int[] names = {R.id.row1_name, R.id.row2_name, R.id.row3_name, R.id.row4_name, R.id.row5_name, R.id.row6_name};
    int[] metas = {R.id.row1_meta, R.id.row2_meta, R.id.row3_meta, R.id.row4_meta, R.id.row5_meta, R.id.row6_meta};
    int[] rows = {R.id.row1, R.id.row2, R.id.row3, R.id.row4, R.id.row5, R.id.row6};
    int[] plus = {R.id.row1_plus, R.id.row2_plus, R.id.row3_plus, R.id.row4_plus, R.id.row5_plus, R.id.row6_plus};
    int[] reset = {R.id.row1_reset, R.id.row2_reset, R.id.row3_reset, R.id.row4_reset, R.id.row5_reset, R.id.row6_reset};
    int n = items == null ? 0 : Math.min(items.length(), 6);
    for (int i = 0; i < 6; i++) {
      if (i >= n) {
        views.setViewVisibility(rows[i], View.GONE);
        continue;
      }
      views.setViewVisibility(rows[i], View.VISIBLE);
      JSONObject h = items.optJSONObject(i);
      String name = (h.optString("emoji") + " " + h.optString("name")).trim();
      String meta = actions ? (h.optInt("count") + "/" + h.optInt("target")) : h.optString("dueLabel");
      views.setTextViewText(names[i], name);
      views.setTextViewText(metas[i], meta);
      views.setViewVisibility(plus[i], actions && !h.optBoolean("done") ? View.VISIBLE : View.GONE);
      views.setViewVisibility(reset[i], actions && h.optInt("count") > 0 ? View.VISIBLE : View.GONE);
      String hid = h.optString("id");
      String date = h.optString("date", snapToday(h));
      views.setOnClickPendingIntent(plus[i], action(ctx, "complete", hid, date, i));
      views.setOnClickPendingIntent(reset[i], action(ctx, "reset", hid, date, i + 10));
    }
    views.setOnClickPendingIntent(R.id.widget_root, open(ctx, "momentum://widget/open"));
  }

  private String snapToday(JSONObject h) {
    return h.optString("date");
  }

  private PendingIntent open(Context ctx, String url) {
    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getActivity(ctx, url.hashCode(), intent, flags);
  }

  private PendingIntent action(Context ctx, String type, String habitId, String date, int req) {
    Intent intent = new Intent(ctx, WidgetActionReceiver.class);
    intent.setAction("app.momentum.habits.WIDGET_" + type.toUpperCase());
    intent.putExtra("type", type);
    intent.putExtra("habitId", habitId);
    intent.putExtra("date", date);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getBroadcast(ctx, req + type.hashCode(), intent, flags);
  }
}
