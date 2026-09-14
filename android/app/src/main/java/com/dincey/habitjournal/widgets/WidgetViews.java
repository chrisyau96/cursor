package com.dincey.habitjournal.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import com.dincey.habitjournal.R;

final class WidgetViews {
  private WidgetViews() {}

  static final int[] ROWS = {
    R.id.habitRow1, R.id.habitRow2, R.id.habitRow3, R.id.habitRow4,
    R.id.habitRow5, R.id.habitRow6, R.id.habitRow7, R.id.habitRow8
  };
  static final int[] TITLES = {
    R.id.habitTitle1, R.id.habitTitle2, R.id.habitTitle3, R.id.habitTitle4,
    R.id.habitTitle5, R.id.habitTitle6, R.id.habitTitle7, R.id.habitTitle8
  };
  static final int[] COUNTS = {
    R.id.habitCount1, R.id.habitCount2, R.id.habitCount3, R.id.habitCount4,
    R.id.habitCount5, R.id.habitCount6, R.id.habitCount7, R.id.habitCount8
  };
  static final int[] PLUS = {
    R.id.habitComplete1, R.id.habitComplete2, R.id.habitComplete3, R.id.habitComplete4,
    R.id.habitComplete5, R.id.habitComplete6, R.id.habitComplete7, R.id.habitComplete8
  };
  static final int[] RESET = {
    R.id.habitReset1, R.id.habitReset2, R.id.habitReset3, R.id.habitReset4,
    R.id.habitReset5, R.id.habitReset6, R.id.habitReset7, R.id.habitReset8
  };

  static int cellCount(int minDp) {
    // Home-screen cells use 70n − 30 dp. Invert so drag-resize maps to columns/rows.
    if (minDp <= 0) return 1;
    return Math.max(1, (minDp + 30) / 70);
  }

  static int habitRowsForHeight(int hCells) {
    if (hCells <= 1) return 1;
    if (hCells == 2) return 2;
    if (hCells == 3) return 4;
    if (hCells == 4) return 6;
    return 8;
  }

  static int[] grid(Bundle opts, int fallbackW, int fallbackH) {
    int minW = opts != null ? opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, fallbackW) : fallbackW;
    int minH = opts != null ? opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, fallbackH) : fallbackH;
    return new int[]{ cellCount(minW), cellCount(minH) };
  }

  static JSONArray pickHabits(Context ctx, JSONObject snap, int appWidgetId, int maxRows) {
    String[] prefIds = WidgetStore.habitIds(ctx, appWidgetId);
    JSONArray selected = snap.optJSONArray("selectedIds");
    JSONArray habits = snap.optJSONArray("habits");
    JSONArray outstanding = snap.optJSONArray("outstanding");
    JSONArray all = snap.optJSONArray("allHabits");
    JSONArray out = new JSONArray();
    java.util.List<String> ids = new java.util.ArrayList<>();
    if (prefIds.length > 0) {
      for (String id : prefIds) if (id != null && !id.isEmpty()) ids.add(id);
    } else if (selected != null && selected.length() > 0) {
      for (int i = 0; i < selected.length(); i++) {
        String id = selected.optString(i);
        if (!id.isEmpty()) ids.add(id);
      }
    } else if (habits != null) {
      for (int i = 0; i < habits.length() && ids.size() < maxRows; i++) {
        JSONObject h = habits.optJSONObject(i);
        if (h != null) ids.add(h.optString("id"));
      }
    } else if (all != null) {
      for (int i = 0; i < all.length() && ids.size() < maxRows; i++) {
        JSONObject h = all.optJSONObject(i);
        if (h != null) ids.add(h.optString("id"));
      }
    }
    for (int i = 0; i < ids.size() && out.length() < maxRows; i++) {
      JSONObject found = findHabit(outstanding, ids.get(i));
      if (found == null) found = findHabit(habits, ids.get(i));
      if (found == null) found = findHabit(all, ids.get(i));
      if (found != null) out.put(found);
    }
    return out;
  }

  static JSONObject findHabit(JSONArray arr, String id) {
    if (arr == null || id == null) return null;
    for (int i = 0; i < arr.length(); i++) {
      JSONObject h = arr.optJSONObject(i);
      if (h != null && id.equals(h.optString("id"))) return h;
    }
    return null;
  }

  static String habitLabel(JSONObject h) {
    String emoji = h.optString("emoji");
    String name = h.optString("name");
    String label = (emoji + " " + name).trim();
    if (h.optBoolean("flex")) label += " · Any";
    return label;
  }

  static String habitDate(JSONObject h, JSONObject snap) {
    String d = h.optString("date");
    if (d != null && !d.isEmpty()) return d;
    return snap != null ? snap.optString("today") : "";
  }

  static void bindHabitRows(Context ctx, RemoteViews views, JSONArray items, JSONObject snap, int appWidgetId, int maxRows, boolean compact) {
    int cap = Math.min(8, Math.max(1, maxRows));
    int n = items == null ? 0 : Math.min(items.length(), cap);
    views.setViewVisibility(R.id.widgetEmpty, n == 0 ? View.VISIBLE : View.GONE);
    for (int i = 0; i < 8; i++) {
      if (i >= n) {
        views.setViewVisibility(ROWS[i], View.GONE);
        continue;
      }
      JSONObject h = items.optJSONObject(i);
      if (h == null) {
        views.setViewVisibility(ROWS[i], View.GONE);
        continue;
      }
      views.setViewVisibility(ROWS[i], View.VISIBLE);
      views.setTextViewText(TITLES[i], habitLabel(h));
      views.setTextViewText(COUNTS[i], h.optInt("count") + "/" + Math.max(1, h.optInt("target")));
      views.setViewVisibility(COUNTS[i], compact ? View.GONE : View.VISIBLE);
      views.setViewVisibility(PLUS[i], View.VISIBLE);
      views.setViewVisibility(RESET[i], View.VISIBLE);
      String hid = h.optString("id");
      String date = habitDate(h, snap);
      views.setOnClickPendingIntent(PLUS[i], action(ctx, "complete", hid, date, appWidgetId, i));
      views.setOnClickPendingIntent(RESET[i], action(ctx, "reset", hid, date, appWidgetId, i));
    }
  }

  static void bindHabitOne(Context ctx, RemoteViews views, JSONArray items, JSONObject snap, int appWidgetId, boolean compact) {
    JSONObject h = items != null && items.length() > 0 ? items.optJSONObject(0) : null;
    if (h == null) {
      views.setViewVisibility(R.id.widgetEmpty, View.VISIBLE);
      views.setViewVisibility(R.id.habitOneRow, View.GONE);
      views.setOnClickPendingIntent(R.id.widgetRoot, open(ctx, "momentum://widget/open", appWidgetId));
      return;
    }
    views.setViewVisibility(R.id.widgetEmpty, View.GONE);
    views.setViewVisibility(R.id.habitOneRow, View.VISIBLE);
    views.setTextViewText(R.id.habitOneTitle, habitLabel(h));
    views.setTextViewText(R.id.habitOneCount, h.optInt("count") + "/" + Math.max(1, h.optInt("target")));
    views.setViewVisibility(R.id.habitOneCount, compact ? View.GONE : View.VISIBLE);
    String hid = h.optString("id");
    String date = habitDate(h, snap);
    views.setOnClickPendingIntent(R.id.habitOneComplete, action(ctx, "complete", hid, date, appWidgetId, 0));
    views.setOnClickPendingIntent(R.id.habitOneReset, action(ctx, "reset", hid, date, appWidgetId, 0));
  }

  static void bindStatDensity(RemoteViews views, android.os.Bundle opts, int labelId) {
    int[] grid = grid(opts, 110, 110);
    views.setViewVisibility(labelId, grid[1] >= 2 ? View.VISIBLE : View.GONE);
  }

  static PendingIntent action(Context ctx, String type, String habitId, String date, int appWidgetId, int row) {
    Intent intent = new Intent(ctx, WidgetActionReceiver.class);
    intent.setAction("com.dincey.habitjournal.WIDGET_" + type.toUpperCase());
    intent.setData(Uri.parse("widget://action/" + type + "/" + appWidgetId + "/" + row + "/" + String.valueOf(habitId)));
    intent.putExtra("type", type);
    intent.putExtra("habitId", habitId);
    intent.putExtra("date", date);
    intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
    int req = appWidgetId * 100 + row * 2 + ("reset".equals(type) ? 1 : 0);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getBroadcast(ctx, req, intent, flags);
  }

  static PendingIntent open(Context ctx, String url, int appWidgetId) {
    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    intent.setPackage(ctx.getPackageName());
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    int req = appWidgetId * 17 + Math.abs(url.hashCode() % 1000);
    return PendingIntent.getActivity(ctx, req, intent, flags);
  }
}
