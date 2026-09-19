package com.dincey.habitjournal.widgets;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONObject;
import com.dincey.habitjournal.R;

public class GiftWidgetProvider extends android.appwidget.AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    JSONObject snap = WidgetStore.readSnapshot(context);
    JSONObject gift = snap.optJSONObject("gift");
    for (int id : appWidgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_gift);
      if (gift == null) {
        views.setTextViewText(R.id.giftIcon, "🎁");
        views.setTextViewText(R.id.giftName, "No gift yet");
        views.setTextViewText(R.id.giftProgress, "Set a gift in Rewards");
      } else {
        String icon = gift.optString("icon", "🎁");
        if (icon == null || icon.isEmpty()) icon = "🎁";
        views.setTextViewText(R.id.giftIcon, icon);
        views.setTextViewText(R.id.giftName, gift.optString("label", "Gift"));
        views.setTextViewText(R.id.giftProgress, gift.optInt("current") + "/" + gift.optInt("target"));
      }
      WidgetViews.bindStatDensity(views, manager.getAppWidgetOptions(id), R.id.giftName);
      views.setOnClickPendingIntent(R.id.widgetRoot, WidgetViews.open(context, "momentum://widget/open", id));
      manager.updateAppWidget(id, views);
    }
  }

  @Override
  public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, android.os.Bundle newOptions) {
    onUpdate(context, manager, new int[]{appWidgetId});
  }
}
