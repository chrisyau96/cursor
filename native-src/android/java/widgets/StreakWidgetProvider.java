package com.dincey.habitjournal.widgets;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONObject;
import com.dincey.habitjournal.R;

public class StreakWidgetProvider extends android.appwidget.AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    JSONObject snap = WidgetStore.readSnapshot(context);
    JSONObject streak = snap.optJSONObject("streak");
    int cur = streak != null ? streak.optInt("current") : 0;
    int best = streak != null ? streak.optInt("best") : 0;
    for (int id : appWidgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_streak);
      views.setTextViewText(R.id.streakFire, "🔥");
      views.setTextViewText(R.id.streakDays, String.valueOf(cur));
      views.setTextViewText(R.id.streakLabel, "Best " + best);
      views.setOnClickPendingIntent(R.id.widgetRoot, WidgetViews.open(context, "momentum://widget/open", id));
      manager.updateAppWidget(id, views);
    }
  }
}
