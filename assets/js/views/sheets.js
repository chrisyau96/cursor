// Habit detail sheet + daily memo sheet.
import { el, iso, todayISO, parseISO, addDaysISO, monthShort, daysInMonth, dowLetter } from "../utils.js";
import {
  currentStreak, bestStreak, totalCompletions, completionRate, freqLabel,
  isComplete, isScheduled, getNote, setNote, MOOD_LIST, progressFor,
} from "../store.js";
import { heatColor } from "../charts.js";
import { habitFormSheet } from "../habitForm.js";

export function habitDetailSheet(ctx, habit) {
  const content = el("div");
  const head = el("div", { class: "row-between" });
  head.appendChild(el("div", { style: "display:flex;align-items:center;gap:12px" }, [
    el("div", { class: "habit-ico", style: `--habit-color:${habit.color};width:44px;height:44px;font-size:22px`, text: habit.icon }),
    el("div", {}, [
      el("h3", { text: habit.name, style: "margin:0" }),
      el("div", { class: "tiny", text: `${freqLabel(habit)} · ${habit.category}` }),
    ]),
  ]));
  const edit = el("button", { class: "m-edit", text: "Edit" });
  edit.addEventListener("click", () => ctx.editHabit(habit));
  head.appendChild(edit);
  content.appendChild(head);

  const today = todayISO();
  const stats = el("div", { class: "detail-stats" });
  stats.appendChild(ds(currentStreak(habit, today), "Current 🔥"));
  stats.appendChild(ds(bestStreak(habit), "Best streak"));
  stats.appendChild(ds(totalCompletions(habit), "Total done"));
  content.appendChild(stats);

  const from30 = addDaysISO(today, -29);
  const rate30 = Math.round(completionRate(habit, from30, today) * 100);
  const bar = el("div", {}, [
    el("div", { class: "row-between", style: "margin-bottom:6px" }, [
      el("span", { class: "tiny", text: "Last 30 days" }),
      el("span", { class: "tiny", style: "color:var(--brand);font-weight:800", text: `${rate30}%` }),
    ]),
    el("div", { class: "pbar" }, [el("i", { style: `width:${rate30}%;background:${habit.color}` })]),
  ]);
  content.appendChild(bar);

  content.appendChild(el("div", { style: "font-weight:800;font-size:13px;margin:16px 0 8px", text: "This month" }));
  content.appendChild(miniMonthHeat(habit));

  const actions = el("div", { class: "sheet-actions", style: "margin-top:18px" });
  const calBtn = el("button", { class: "btn btn-soft", text: "Open calendar" });
  calBtn.addEventListener("click", () => { ctx.state.calHabitId = habit.id; ctx.closeSheet(); ctx.goTo("calendar"); });
  const editBtn = el("button", { class: "btn btn-primary", text: "Edit habit" });
  editBtn.addEventListener("click", () => ctx.editHabit(habit));
  actions.appendChild(calBtn);
  actions.appendChild(editBtn);
  content.appendChild(actions);

  ctx.openSheet(content);
}

function ds(value, label) {
  return el("div", { class: "ds" }, [
    el("div", { class: "v", text: String(value) }),
    el("div", { class: "l", text: label }),
  ]);
}

function miniMonthHeat(habit) {
  const now = parseISO(todayISO());
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const total = daysInMonth(year, month);
  const grid = el("div", { class: "heatgrid", style: "grid-template-columns:repeat(7,1fr)" });
  const dow = el("div", { style: "display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:4px" });
  for (let i = 0; i < 7; i++) dow.appendChild(el("div", { class: "tiny center", text: dowLetter(i) }));
  const wrap = el("div");
  wrap.appendChild(dow);
  for (let i = 0; i < first.getDay(); i++) grid.appendChild(el("div"));
  const today = todayISO();
  for (let d = 1; d <= total; d++) {
    const dISO = iso(new Date(year, month, d));
    const cell = el("div", { class: "heatcell", title: dISO });
    if (!isScheduled(habit, dISO)) {
      cell.style.background = "transparent";
      cell.style.border = "1px dashed var(--line)";
    } else if (isComplete(habit, dISO)) {
      cell.style.background = habit.color;
    } else if (dISO <= today) {
      cell.style.background = "var(--red-soft)";
    }
    if (dISO === today) cell.style.outline = "2px solid var(--brand)";
    grid.appendChild(cell);
  }
  wrap.appendChild(grid);
  return wrap;
}

export function dayMemoSheet(ctx, date) {
  const note = getNote(date);
  let mood = note.mood;
  const content = el("div");
  content.appendChild(el("h3", { text: "Daily memo" }));
  content.appendChild(el("div", { class: "sheet-sub", text: "How did the day feel? Add a mood and a short reflection." }));

  const moodRow = el("div", { class: "mood-row" });
  MOOD_LIST.forEach((emo, i) => {
    const b = el("button", { type: "button", text: emo, class: mood === i ? "sel" : "" });
    b.addEventListener("click", () => {
      mood = mood === i ? null : i;
      Array.from(moodRow.children).forEach((c) => c.classList.remove("sel"));
      if (mood != null) b.classList.add("sel");
    });
    moodRow.appendChild(b);
  });
  content.appendChild(el("div", { class: "field" }, [el("label", { text: "Mood" }), moodRow]));

  const ta = el("textarea", { placeholder: "One sentence about today…", maxlength: "500" });
  ta.value = note.text || "";
  content.appendChild(el("div", { class: "field" }, [el("label", { text: "Reflection" }), ta]));

  const actions = el("div", { class: "sheet-actions" });
  const save = el("button", { class: "btn btn-primary", text: "Save memo" });
  save.addEventListener("click", () => {
    setNote(date, { text: ta.value.trim(), mood });
    ctx.toast("Memo saved");
    ctx.closeSheet();
  });
  actions.appendChild(save);
  content.appendChild(actions);
  ctx.openSheet(content);
  setTimeout(() => ta.focus(), 120);
}
