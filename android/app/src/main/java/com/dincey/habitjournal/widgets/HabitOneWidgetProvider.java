package com.dincey.habitjournal.widgets;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import com.dincey.habitjournal.R;

public class HabitOneWidgetProvider extends android.appwidget.AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    JSONObject snap = WidgetStore.readSnapshot(context);
    for (int id : appWidgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_habit_one);
      android.os.Bundle opts = manager.getAppWidgetOptions(id);
      int[] grid = WidgetViews.grid(opts, 110, 40);
      JSONArray items = WidgetViews.pickHabits(context, snap, id, 1);
      WidgetViews.bindHabitOne(context, views, items, snap, id, grid[0] < 3);
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
