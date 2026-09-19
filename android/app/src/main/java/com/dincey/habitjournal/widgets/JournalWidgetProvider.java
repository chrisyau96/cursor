package com.dincey.habitjournal.widgets;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;
import com.dincey.habitjournal.R;

public class JournalWidgetProvider extends android.appwidget.AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    for (int id : appWidgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_journal);
      WidgetViews.bindStatDensity(views, manager.getAppWidgetOptions(id), R.id.journalLabel);
      views.setOnClickPendingIntent(R.id.journalPlus, WidgetViews.open(context, "momentum://widget/journal", id));
      views.setOnClickPendingIntent(R.id.journalLabel, WidgetViews.open(context, "momentum://widget/journal", id));
      views.setOnClickPendingIntent(R.id.widgetRoot, WidgetViews.open(context, "momentum://widget/journal", id));
      manager.updateAppWidget(id, views);
    }
  }

  @Override
  public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, android.os.Bundle newOptions) {
    onUpdate(context, manager, new int[]{appWidgetId});
  }
}
