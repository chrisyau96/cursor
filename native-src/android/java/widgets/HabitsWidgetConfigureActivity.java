package com.dincey.habitjournal.widgets;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
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
  private final ArrayList<View> picks = new ArrayList<>();

  protected int maxHabits() {
    return 8;
  }

  protected Class<?> providerClass() {
    return HabitsWidgetProvider.class;
  }

  protected String titleText() {
    return "Pick 1–8 habits";
  }

  protected String hintText() {
    return "Not specific habits are listed too. Resize the widget later to show more or fewer rows.";
  }

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
      for (int i = 0; i < selected.length() && pre.size() < maxHabits(); i++) pre.add(selected.optString(i));
    }

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(Color.parseColor("#F8FAFF"));
    int pad = (int) (16 * getResources().getDisplayMetrics().density);
    root.setPadding(pad, pad, pad, pad);

    TextView title = new TextView(this);
    title.setText(titleText());
    title.setTextSize(20);
    title.setTextColor(Color.parseColor("#0F172A"));
    title.setPadding(0, 0, 0, pad / 2);
    root.addView(title);

    TextView hint = new TextView(this);
    hint.setText(hintText());
    hint.setTextSize(13);
    hint.setTextColor(Color.parseColor("#64748B"));
    hint.setPadding(0, 0, 0, pad);
    root.addView(hint);

    if (all == null || all.length() == 0) {
      TextView empty = new TextView(this);
      empty.setText("Open Habit & Journal and add habits first, including Not specific if you want those on the widget.");
      empty.setTextColor(Color.parseColor("#64748B"));
      root.addView(empty);
    } else if (maxHabits() == 1) {
      RadioGroup group = new RadioGroup(this);
      group.setOrientation(RadioGroup.VERTICAL);
      for (int i = 0; i < all.length(); i++) {
        JSONObject h = all.optJSONObject(i);
        if (h == null) continue;
        RadioButton box = new RadioButton(this);
        String id = h.optString("id");
        box.setText(labelFor(h));
        box.setTag(id);
        box.setChecked(pre.contains(id));
        box.setTextColor(Color.parseColor("#0F172A"));
        box.setPadding(0, pad / 4, 0, pad / 4);
        picks.add(box);
        group.addView(box);
      }
      root.addView(group);
    } else {
      for (int i = 0; i < all.length(); i++) {
        JSONObject h = all.optJSONObject(i);
        if (h == null) continue;
        CheckBox box = new CheckBox(this);
        String id = h.optString("id");
        box.setText(labelFor(h));
        box.setTag(id);
        box.setChecked(pre.contains(id));
        box.setTextColor(Color.parseColor("#0F172A"));
        box.setOnCheckedChangeListener((v, checked) -> {
          int n = 0;
          for (View b : picks) if (b instanceof CheckBox && ((CheckBox) b).isChecked()) n++;
          if (n > maxHabits()) {
            ((CheckBox) v).setChecked(false);
            Toast.makeText(this, "Pick up to " + maxHabits() + " habits", Toast.LENGTH_SHORT).show();
          }
        });
        picks.add(box);
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
    scroll.setBackgroundColor(Color.parseColor("#F8FAFF"));
    scroll.addView(root);
    setContentView(scroll);
  }

  private String labelFor(JSONObject h) {
    String label = (h.optString("emoji") + " " + h.optString("name")).trim();
    if (h.optBoolean("flex")) label += "  · Not specific";
    return label;
  }

  private void saveAndClose() {
    ArrayList<String> ids = new ArrayList<>();
    for (View b : picks) {
      boolean on = b instanceof CheckBox ? ((CheckBox) b).isChecked() : b instanceof RadioButton && ((RadioButton) b).isChecked();
      if (on && b.getTag() != null) ids.add(String.valueOf(b.getTag()));
    }
    if (ids.isEmpty()) {
      Toast.makeText(this, maxHabits() == 1 ? "Pick one habit" : "Pick at least one habit", Toast.LENGTH_SHORT).show();
      return;
    }
    if (ids.size() > maxHabits()) ids = new ArrayList<>(ids.subList(0, maxHabits()));
    WidgetStore.setHabitIds(this, appWidgetId, ids.toArray(new String[0]));
    AppWidgetManager manager = AppWidgetManager.getInstance(this);
    try {
      android.appwidget.AppWidgetProvider provider =
        (android.appwidget.AppWidgetProvider) providerClass().getDeclaredConstructor().newInstance();
      provider.onUpdate(this, manager, new int[]{appWidgetId});
    } catch (Exception e) {
      new HabitsWidgetProvider().onUpdate(this, manager, new int[]{appWidgetId});
    }
    Intent result = new Intent();
    result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
    setResult(RESULT_OK, result);
    finish();
  }
}
