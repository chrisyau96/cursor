package com.dincey.habitjournal.widgets;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public final class WidgetStore {
  private WidgetStore() {}

  public static File snapshotFile(Context ctx) {
    File dir = new File(ctx.getFilesDir(), "momentum");
    if (!dir.exists()) dir.mkdirs();
    return new File(dir, "widget-snapshot.json");
  }

  static File pendingFile(Context ctx) {
    File dir = new File(ctx.getFilesDir(), "momentum");
    if (!dir.exists()) dir.mkdirs();
    return new File(dir, "widget-pending.json");
  }

  public static JSONObject readSnapshot(Context ctx) {
    try {
      File f = snapshotFile(ctx);
      if (!f.exists()) return new JSONObject();
      FileInputStream in = new FileInputStream(f);
      byte[] buf = new byte[(int) f.length()];
      int n = in.read(buf);
      in.close();
      return new JSONObject(new String(buf, 0, Math.max(0, n), StandardCharsets.UTF_8));
    } catch (Exception e) {
      return new JSONObject();
    }
  }

  public static void writeSnapshot(Context ctx, JSONObject snap) {
    try {
      FileOutputStream out = new FileOutputStream(snapshotFile(ctx));
      out.write(snap.toString().getBytes(StandardCharsets.UTF_8));
      out.close();
    } catch (Exception ignored) {}
  }

  static JSONArray readPending(Context ctx) {
    try {
      File f = pendingFile(ctx);
      if (!f.exists()) return new JSONArray();
      FileInputStream in = new FileInputStream(f);
      byte[] buf = new byte[(int) f.length()];
      int n = in.read(buf);
      in.close();
      return new JSONArray(new String(buf, 0, Math.max(0, n), StandardCharsets.UTF_8));
    } catch (Exception e) {
      return new JSONArray();
    }
  }

  static void writePending(Context ctx, JSONArray arr) {
    try {
      FileOutputStream out = new FileOutputStream(pendingFile(ctx));
      out.write(arr.toString().getBytes(StandardCharsets.UTF_8));
      out.close();
    } catch (Exception ignored) {}
  }

  static void enqueue(Context ctx, String type, String habitId, String date) {
    try {
      JSONArray arr = readPending(ctx);
      JSONObject action = new JSONObject();
      action.put("type", type);
      if (habitId != null) action.put("habitId", habitId);
      if (date != null) action.put("date", date);
      action.put("at", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(new java.util.Date()));
      arr.put(action);
      writePending(ctx, arr);
    } catch (Exception ignored) {}
  }

  public static void refreshAll(Context ctx) {
    Class<?>[] types = {
      MomentumWidgetProvider.class,
      StreakWidgetProvider.class,
      CreditsWidgetProvider.class,
      GiftWidgetProvider.class,
      JournalWidgetProvider.class
    };
    AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
    for (Class<?> type : types) {
      Intent intent = new Intent(ctx, type);
      intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
      int[] ids = manager.getAppWidgetIds(new ComponentName(ctx, type));
      if (ids == null || ids.length == 0) continue;
      intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
      ctx.sendBroadcast(intent);
    }
  }
}
