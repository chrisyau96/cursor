package com.dincey.habitjournal.widgets;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import com.dincey.habitjournal.R;

public class HabitsWidgetProvider extends android.appwidget.AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    JSONObject snap = WidgetStore.readSnapshot(context);
    for (int id : appWidgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_habits);
      int rows = WidgetViews.adaptiveRows(manager.getAppWidgetOptions(id), 8);
      JSONArray items = WidgetViews.pickHabits(context, snap, id, rows);
      views.setTextViewText(R.id.habitsHeader, context.getString(R.string.widget_habits));
      WidgetViews.bindHabitRows(context, views, items, snap, id, rows);
      views.setOnClickPendingIntent(R.id.habitsHeaderBar, WidgetViews.open(context, "momentum://widget/open", id));
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
