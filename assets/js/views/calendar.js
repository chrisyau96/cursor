// Calendar view: monthly grid with per-habit or overall completion heat.
import { el, iso, todayISO, parseISO, monthName, daysInMonth, dowLetter } from "../utils.js";
import {
  activeHabits, getHabit, isScheduled, isComplete, dayCompletion, dayProgress,
  currentStreak, bestStreak, completionRate,
} from "../store.js";
import { heatColor, heatLegend } from "../charts.js";

export function topbarFor() { return { title: "Calendar", sub: "Track your consistency" }; }

export function render(ctx) {
  const view = el("div", { class: "view" });
  if (ctx.state.calYear == null) {
    const now = parseISO(todayISO());
    ctx.state.calYear = now.getFullYear();
    ctx.state.calMonth = now.getMonth();
  }
  const habits = activeHabits();

  // Habit selector
  view.appendChild(habitSelector(ctx, habits));

  // Month card
  view.appendChild(monthCard(ctx));

  // Stats under calendar
  view.appendChild(monthStats(ctx));

  return view;
}

function habitSelector(ctx, habits) {
  const wrap = el("div", { style: "overflow-x:auto;margin:2px 0 6px" });
  const row = el("div", { style: "display:flex;gap:8px;padding-bottom:4px" });
  const mkChip = (label, id, color) => {
    const active = (ctx.state.calHabitId || "all") === (id || "all");
    const chip = el("button", {
      class: "pill-badge",
      style: `padding:8px 14px;font-size:13px;white-space:nowrap;${active ? "background:linear-gradient(140deg,var(--brand),var(--brand-2));color:#fff" : "background:var(--card);border:1px solid var(--line);color:var(--muted)"}`,
      text: label,
    });
    chip.addEventListener("click", () => { ctx.state.calHabitId = id; ctx.render(); });
    return chip;
  };
  row.appendChild(mkChip("All habits", "all"));
  habits.forEach((h) => row.appendChild(mkChip(`${h.icon} ${h.name}`, h.id, h.color)));
  wrap.appendChild(row);
  return wrap;
}

function monthCard(ctx) {
  const { calYear: year, calMonth: month } = ctx.state;
  const habitId = ctx.state.calHabitId && ctx.state.calHabitId !== "all" ? ctx.state.calHabitId : null;
  const habit = habitId ? getHabit(habitId) : null;

  const card = el("div", { class: "card card-pad" });
  const head = el("div", { class: "cal-head" });
  const prev = el("button", { class: "icon-btn", text: "‹" });
  prev.addEventListener("click", () => shiftMonth(ctx, -1));
  const next = el("button", { class: "icon-btn", text: "›" });
  next.addEventListener("click", () => shiftMonth(ctx, 1));
  head.appendChild(prev);
  head.appendChild(el("div", { class: "cal-title", text: `${monthName(month)} ${year}` }));
  head.appendChild(next);
  card.appendChild(head);

  const dowRow = el("div", { class: "cal-dow" });
  for (let i = 0; i < 7; i++) dowRow.appendChild(el("span", { text: dowLetter(i) }));
  card.appendChild(dowRow);

  const grid = el("div", { class: "cal-grid" });
  const first = new Date(year, month, 1);
  for (let i = 0; i < first.getDay(); i++) grid.appendChild(el("div", { class: "cal-cell empty" }));
  const total = daysInMonth(year, month);
  const today = todayISO();
  for (let d = 1; d <= total; d++) {
    const dISO = iso(new Date(year, month, d));
    grid.appendChild(dayCell(ctx, dISO, d, habit, today));
  }
  card.appendChild(grid);
  card.appendChild(heatLegend());
  return card;
}

function dayCell(ctx, dISO, dayNum, habit, today) {
  const cell = el("div", { class: "cal-cell" });
  const isFuture = dISO > today;
  if (isFuture) cell.classList.add("future");
  if (dISO === today) cell.classList.add("today");

  let ratio = 0;
  let scheduled = true;
  if (habit) {
    scheduled = isScheduled(habit, dISO);
    ratio = scheduled && isComplete(habit, dISO) ? 1 : 0;
  } else {
    ratio = dayProgress(dISO);
  }

  if (!isFuture) {
    if (habit && !scheduled) {
      cell.style.background = "transparent";
      cell.style.border = "1px dashed var(--line)";
    } else if (ratio > 0) {
      const col = habit ? habit.color : heatColor(ratio);
      cell.style.background = col;
      cell.style.borderColor = "transparent";
    }
  }

  const useWhite = !isFuture && ((habit && ratio >= 1) || (!habit && ratio >= 0.66));
  const num = el("div", { text: String(dayNum), style: useWhite ? "color:#fff" : "" });
  cell.appendChild(num);

  if (!habit && !isFuture) {
    const { done, total } = dayCompletion(dISO);
    if (total) cell.appendChild(el("div", { class: "fill-badge", style: useWhite ? "color:rgba(255,255,255,.85)" : "", text: `${done}/${total}` }));
  }

  cell.addEventListener("click", () => {
    if (isFuture) { ctx.toast("That day hasn't happened yet"); return; }
    ctx.setSelectedDate(dISO);
    ctx.goTo("today");
  });
  return cell;
}

function shiftMonth(ctx, delta) {
  let m = ctx.state.calMonth + delta;
  let y = ctx.state.calYear;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  ctx.state.calMonth = m;
  ctx.state.calYear = y;
  ctx.render();
}

function monthStats(ctx) {
  const { calYear: year, calMonth: month } = ctx.state;
  const habitId = ctx.state.calHabitId && ctx.state.calHabitId !== "all" ? ctx.state.calHabitId : null;
  const habit = habitId ? getHabit(habitId) : null;
  const total = daysInMonth(year, month);
  const today = todayISO();
  const from = iso(new Date(year, month, 1));
  const lastDay = Math.min(total, (year === parseISO(today).getFullYear() && month === parseISO(today).getMonth()) ? parseISO(today).getDate() : total);
  const to = iso(new Date(year, month, lastDay));

  let doneDays = 0, activeDays = 0, perfect = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dISO = iso(new Date(year, month, d));
    if (habit) {
      if (!isScheduled(habit, dISO)) continue;
      activeDays++;
      if (isComplete(habit, dISO)) doneDays++;
    } else {
      const { done, total: t, ratio } = dayCompletion(dISO);
      if (!t) continue;
      activeDays++;
      if (done > 0) doneDays++;
      if (ratio >= 1) perfect++;
    }
  }
  const rate = activeDays ? Math.round((doneDays / activeDays) * 100) : 0;

  const grid = el("div", { class: "stat-grid", style: "margin-top:14px" });
  grid.appendChild(statTile("📈", "Completion", `${rate}%`, "this month"));
  if (habit) {
    grid.appendChild(statTile("🔥", "Current streak", String(currentStreak(habit, today)), "days"));
    grid.appendChild(statTile("🏆", "Best streak", String(bestStreak(habit)), "days"));
    grid.appendChild(statTile("✅", "Days done", String(doneDays), `of ${activeDays}`));
  } else {
    grid.appendChild(statTile("⭐", "Perfect days", String(perfect), "all done"));
    grid.appendChild(statTile("✅", "Active days", String(doneDays), `of ${activeDays}`));
    grid.appendChild(statTile("🎯", "Habits", String(activeHabits().length), "tracked"));
  }
  return grid;
}

function statTile(ico, label, val, unit) {
  return el("div", { class: "stat-tile" }, [
    el("div", { class: "stat-top" }, [
      el("span", { class: "stat-ico", text: ico }),
      el("span", { class: "stat-label", text: label }),
    ]),
    el("div", { class: "stat-val" }, [document.createTextNode(val + " "), el("span", { class: "stat-unit", text: unit })]),
  ]);
}
