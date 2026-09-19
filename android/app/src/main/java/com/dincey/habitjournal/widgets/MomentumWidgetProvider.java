package com.dincey.habitjournal.widgets;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import com.dincey.habitjournal.R;

public class MomentumWidgetProvider extends android.appwidget.AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    JSONObject snap = WidgetStore.readSnapshot(context);
    for (int id : appWidgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_momentum);
      android.os.Bundle opts = manager.getAppWidgetOptions(id);
      int[] grid = WidgetViews.grid(opts, 250, 110);
      boolean showHeader = grid[1] >= 2;
      views.setViewVisibility(R.id.widgetHeader, showHeader ? View.VISIBLE : View.GONE);
      views.setViewVisibility(R.id.widgetDate, grid[0] >= 3 ? View.VISIBLE : View.GONE);
      views.setTextViewText(R.id.widgetTitle, context.getString(R.string.widget_name));
      views.setTextViewText(R.id.widgetDate, snap.optString("today"));
      JSONArray items = snap.optJSONArray("outstanding");
      int rows = WidgetViews.habitRowsForHeight(grid[1]);
      WidgetViews.bindHabitRows(context, views, items, snap, id, rows, grid[0] < 3);
      views.setOnClickPendingIntent(R.id.widgetHeader, WidgetViews.open(context, "momentum://widget/open", id));
      manager.updateAppWidget(id, views);
    }
  }

  @Override
  public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, android.os.Bundle newOptions) {
    onUpdate(context, manager, new int[]{appWidgetId});
  }

  @Override
  public void onDeleted(Context context, int[] appWidgetIds) {
    for (int id : appWidgetIds) WidgetStore.clearHabitIds(context, id);
  }
}
