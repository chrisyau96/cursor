package com.dincey.habitjournal.widgets;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

public class HabitsWidgetConfigureActivity extends Activity {
  private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
  private final ArrayList<CheckBox> boxes = new ArrayList<>();

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setResult(RESULT_CANCELED);
    Intent intent = getIntent();
    Bundle extras = intent.getExtras();
    if (extras != null) {
      appWidgetId = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
    }
    if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      finish();
      return;
    }

    JSONObject snap = WidgetStore.readSnapshot(this);
    JSONArray all = snap.optJSONArray("allHabits");
    if (all == null || all.length() == 0) all = snap.optJSONArray("outstanding");
    Set<String> pre = new HashSet<>();
    for (String id : WidgetStore.habitIds(this, appWidgetId)) pre.add(id);
    JSONArray selected = snap.optJSONArray("selectedIds");
    if (pre.isEmpty() && selected != null) {
      for (int i = 0; i < selected.length(); i++) pre.add(selected.optString(i));
    }

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    int pad = (int) (16 * getResources().getDisplayMetrics().density);
    root.setPadding(pad, pad, pad, pad);

    TextView title = new TextView(this);
    title.setText("Pick 1–5 habits");
    title.setTextSize(18);
    title.setPadding(0, 0, 0, pad / 2);
    root.addView(title);

    TextView hint = new TextView(this);
    hint.setText("Resize the widget later to show more or fewer of these habits.");
    hint.setTextSize(13);
    hint.setPadding(0, 0, 0, pad);
    root.addView(hint);

    if (all == null || all.length() == 0) {
      TextView empty = new TextView(this);
      empty.setText("Open Habit & Journal and add habits first.");
      root.addView(empty);
    } else {
      for (int i = 0; i < all.length(); i++) {
        JSONObject h = all.optJSONObject(i);
        if (h == null) continue;
        CheckBox box = new CheckBox(this);
        String id = h.optString("id");
        box.setText((h.optString("emoji") + " " + h.optString("name")).trim());
        box.setTag(id);
        box.setChecked(pre.contains(id));
        box.setOnCheckedChangeListener((v, checked) -> {
          int n = 0;
          for (CheckBox b : boxes) if (b.isChecked()) n++;
          if (n > 5) {
            v.setChecked(false);
            Toast.makeText(this, "Pick up to 5 habits", Toast.LENGTH_SHORT).show();
          }
        });
        boxes.add(box);
        root.addView(box);
      }
    }

    Button save = new Button(this);
    save.setText("Add widget");
    save.setOnClickListener(v -> saveAndClose());
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    lp.topMargin = pad;
    save.setLayoutParams(lp);
    root.addView(save);

    ScrollView scroll = new ScrollView(this);
    scroll.addView(root);
    setContentView(scroll);
  }

  private void saveAndClose() {
    ArrayList<String> ids = new ArrayList<>();
    for (CheckBox b : boxes) {
      if (b.isChecked() && b.getTag() != null) ids.add(String.valueOf(b.getTag()));
    }
    if (ids.isEmpty()) {
      Toast.makeText(this, "Pick at least one habit", Toast.LENGTH_SHORT).show();
      return;
    }
    WidgetStore.setHabitIds(this, appWidgetId, ids.toArray(new String[0]));
    AppWidgetManager manager = AppWidgetManager.getInstance(this);
    new HabitsWidgetProvider().onUpdate(this, manager, new int[]{appWidgetId});
    Intent result = new Intent();
    result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
    setResult(RESULT_OK, result);
    finish();
  }
}
