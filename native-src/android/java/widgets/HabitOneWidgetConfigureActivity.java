package com.dincey.habitjournal.widgets;

public class HabitOneWidgetConfigureActivity extends HabitsWidgetConfigureActivity {
  @Override
  protected int maxHabits() {
    return 1;
  }

  @Override
  protected Class<?> providerClass() {
    return HabitOneWidgetProvider.class;
  }

  @Override
  protected String titleText() {
    return "Pick 1 habit";
  }

  @Override
  protected String hintText() {
    return "Not specific habits can be selected too. +1 and reset stay on the widget.";
  }
}
