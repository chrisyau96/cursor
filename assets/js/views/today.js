// Today view: week strip, day progress ring, habit check-off, daily memo.
import { el, iso, todayISO, parseISO, addDaysISO, startOfWeek, dowLetter, relativeDay, esc } from "../utils.js";
import {
  scheduledHabits, activeHabits, isScheduled, isComplete, getRecord, progressFor,
  toggleCheck, incrementCount, currentStreak, dayCompletion, dayProgress,
  getNote, freqLabel, moodEmoji,
} from "../store.js";
import { progressRing } from "../charts.js";
import { habitDetailSheet, dayMemoSheet } from "./sheets.js";

export function topbarFor(ctx) {
  return { title: "Momentum", sub: relativeDay(ctx.state.selectedDate) };
}

export function render(ctx) {
  const date = ctx.state.selectedDate;
  const view = el("div", { class: "view" });

  view.appendChild(weekStrip(ctx));
  view.appendChild(dayHero(ctx, date));

  const scheduled = scheduledHabits(date);
  const others = activeHabits().filter((h) => !isScheduled(h, date));

  if (activeHabits().length === 0) {
    view.appendChild(emptyState(ctx));
    return view;
  }

  view.appendChild(sectionTitle("Today’s habits", `${scheduled.length} scheduled`));
  const list = el("div", { class: "habit-list" });
  if (scheduled.length === 0) {
    list.appendChild(el("div", { class: "card card-pad muted center", text: "No habits scheduled for this day. Enjoy the rest!" }));
  }
  scheduled.forEach((h) => list.appendChild(habitRow(ctx, h, date)));
  view.appendChild(list);

  if (others.length) {
    view.appendChild(sectionTitle("Not scheduled today", ""));
    const list2 = el("div", { class: "habit-list" });
    others.forEach((h) => list2.appendChild(habitRow(ctx, h, date, true)));
    view.appendChild(list2);
  }

  view.appendChild(memoCard(ctx, date));
  return view;
}

function weekStrip(ctx) {
  const sel = ctx.state.selectedDate;
  const anchor = parseISO(sel);
  const start = startOfWeek(anchor);
  const strip = el("div", { class: "weekstrip" });
  const today = todayISO();
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const di = iso(d);
    const prog = dayProgress(di);
    const cell = el("button", { class: "wday" });
    if (di === today) cell.classList.add("today");
    if (di === sel) cell.classList.add("selected");
    if (prog > 0) cell.classList.add("has-progress");
    cell.appendChild(el("span", { class: "dow", text: dowLetter(d.getDay()) }));
    cell.appendChild(el("span", { class: "dnum", text: String(d.getDate()) }));
    cell.appendChild(el("span", { class: "ddot" }));
    cell.addEventListener("click", () => ctx.setSelectedDate(di));
    strip.appendChild(cell);
  }
  // week nav arrows row
  const nav = el("div", { class: "row-between", style: "margin:2px 2px 0" });
  const prev = el("button", { class: "tiny", text: "‹ Prev week", style: "font-weight:700;color:var(--brand)" });
  prev.addEventListener("click", () => ctx.setSelectedDate(addDaysISO(sel, -7)));
  const next = el("button", { class: "tiny", text: "Next week ›", style: "font-weight:700;color:var(--brand)" });
  next.addEventListener("click", () => ctx.setSelectedDate(addDaysISO(sel, 7)));
  const wrap = el("div");
  wrap.appendChild(nav);
  nav.appendChild(prev);
  const jump = el("button", { class: "tiny", text: "Today", style: "font-weight:700;color:var(--muted)" });
  jump.addEventListener("click", () => ctx.setSelectedDate(today));
  nav.appendChild(jump);
  nav.appendChild(next);
  wrap.appendChild(strip);
  return wrap;
}

function dayHero(ctx, date) {
  const { done, total } = dayCompletion(date);
  const ratio = total ? done / total : 0;
  const hero = el("div", { class: "day-hero" });
  hero.appendChild(progressRing(dayProgress(date), { size: 76, stroke: 9, label: `${Math.round(ratio * 100)}%` }));
  const info = el("div", { class: "day-hero-info" });
  info.appendChild(el("div", { class: "big", text: total ? `${done} of ${total} done` : "No habits today" }));
  const msg = ratio >= 1 && total ? "Perfect day. Every vote counts."
    : ratio >= 0.5 ? "Good momentum — keep going."
    : done > 0 ? "Nice start. Small wins add up."
    : "Tick your first habit to begin.";
  info.appendChild(el("div", { class: "small", text: msg }));
  const chips = el("div", { class: "chips" });
  const streakSum = activeHabits().reduce((m, h) => Math.max(m, currentStreak(h, date)), 0);
  chips.appendChild(el("span", { class: "hero-chip", text: `🔥 ${streakSum} best streak` }));
  const note = getNote(date);
  if (note.mood != null) chips.appendChild(el("span", { class: "hero-chip", text: `${moodEmoji(note.mood)} mood` }));
  info.appendChild(chips);
  hero.appendChild(info);
  return hero;
}

function habitRow(ctx, habit, date, isOff = false) {
  const complete = isComplete(habit, date);
  const row = el("div", { class: "habit-row" + (complete ? " done" : "") + (isOff ? " off" : "") });
  row.style.setProperty("--habit-color", habit.color);

  const ico = el("div", { class: "habit-ico", text: habit.icon });
  row.appendChild(ico);

  const main = el("div", { class: "habit-main" });
  main.appendChild(el("div", { class: "habit-name", text: habit.name }));
  const streak = currentStreak(habit, date);
  const subBits = [];
  if (habit.type === "count") subBits.push(`${getRecord(date, habit.id)}/${habit.target} ${habit.unit || ""}`.trim());
  else subBits.push(freqLabel(habit));
  const sub = el("div", { class: "habit-sub" });
  sub.appendChild(el("span", { text: subBits[0] }));
  if (streak > 0) sub.appendChild(el("span", { class: "streak-badge", text: `🔥 ${streak}` }));
  main.appendChild(sub);
  if (habit.type === "count") {
    const line = el("div", { class: "habit-progress-line" }, [el("i")]);
    line.firstChild.style.width = `${Math.round(progressFor(habit, date) * 100)}%`;
    main.appendChild(line);
  }
  main.addEventListener("click", () => habitDetailSheet(ctx, habit));
  row.appendChild(main);

  if (habit.type === "count") {
    const counter = el("div", { class: "habit-counter" });
    const minus = el("button", { class: "count-btn", text: "−" });
    minus.addEventListener("click", (e) => { e.stopPropagation(); incrementCount(date, habit.id, -1); });
    const val = el("div", { class: "count-val", text: `${getRecord(date, habit.id)}/${habit.target}` });
    const plus = el("button", { class: "count-btn", text: "+" });
    plus.addEventListener("click", (e) => { e.stopPropagation(); incrementCount(date, habit.id, 1); });
    counter.appendChild(minus);
    counter.appendChild(val);
    counter.appendChild(plus);
    row.appendChild(counter);
  } else {
    const check = el("button", { class: "habit-check", text: "✓" });
    check.addEventListener("click", (e) => { e.stopPropagation(); toggleCheck(date, habit.id); });
    row.appendChild(check);
  }
  return row;
}

function memoCard(ctx, date) {
  const note = getNote(date);
  const card = el("div", { class: "card card-pad", style: "margin-top:14px" });
  const head = el("div", { class: "row-between" });
  head.appendChild(el("div", { style: "font-weight:800;font-size:14px" }, [
    document.createTextNode("Daily memo "),
    note.mood != null ? el("span", { text: moodEmoji(note.mood) }) : document.createTextNode(""),
  ]));
  const editBtn = el("button", { class: "m-edit", text: note.text || note.mood != null ? "Edit" : "Add" });
  editBtn.addEventListener("click", () => dayMemoSheet(ctx, date));
  head.appendChild(editBtn);
  card.appendChild(head);
  card.appendChild(el("div", {
    class: "note-preview",
    style: "margin-top:8px",
    text: note.text ? note.text : "How did today feel? Capture a mood and a sentence.",
  }));
  return card;
}

function sectionTitle(title, link) {
  const wrap = el("div", { class: "section-title" });
  wrap.appendChild(el("h2", { text: title }));
  if (link) wrap.appendChild(el("span", { class: "link", text: link }));
  return wrap;
}

function emptyState(ctx) {
  const wrap = el("div", { class: "empty" });
  wrap.appendChild(el("div", { class: "emoji", text: "🌱" }));
  wrap.appendChild(el("h3", { text: "No habits yet" }));
  wrap.appendChild(el("p", { text: "Create your first habit to start building momentum." }));
  const btn = el("button", { class: "btn btn-primary", text: "+ New habit" });
  btn.addEventListener("click", () => ctx.addHabit());
  wrap.appendChild(btn);
  return wrap;
}
