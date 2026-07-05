// Today view: live date/time, week strip, day progress, habit check-off,
// a gamification summary, and an inline journal (mood + score + reflection).
import { el, iso, todayISO, parseISO, addDaysISO, startOfWeek, dowLetter, relativeDay } from "../utils.js";
import {
  scheduledHabits, activeHabits, isScheduled, isComplete, getRecord, progressFor,
  toggleCheck, incrementCount, currentStreak, dayCompletion, dayProgress,
  getNote, setNote, deleteNote, freqLabel, moodEmoji, MOOD_LIST, getLastEntry,
} from "../store.js";
import { progressRing } from "../charts.js";
import { computeStats, creditsForRatio } from "../gamify.js";
import { habitDetailSheet } from "./sheets.js";

export function topbarFor(ctx) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const rel = relativeDay(ctx.state.selectedDate);
  const dateStr = parseISO(ctx.state.selectedDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return { title: "Momentum", sub: `${rel === "Today" ? dateStr : rel} · ${time}` };
}

export function render(ctx) {
  const date = ctx.state.selectedDate;
  const view = el("div", { class: "view" });

  view.appendChild(weekStrip(ctx));
  view.appendChild(dayHero(ctx, date));
  view.appendChild(gamifySummary(ctx, date));

  if (activeHabits().length === 0) {
    view.appendChild(emptyState(ctx));
    return view;
  }

  const scheduled = scheduledHabits(date);
  const others = activeHabits().filter((h) => !isScheduled(h, date));

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

  view.appendChild(journalCard(ctx, date));
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
  const nav = el("div", { class: "row-between", style: "margin:2px 2px 0" });
  const prev = el("button", { class: "tiny", text: "‹ Prev week", style: "font-weight:700;color:var(--brand)" });
  prev.addEventListener("click", () => ctx.setSelectedDate(addDaysISO(sel, -7)));
  const next = el("button", { class: "tiny", text: "Next week ›", style: "font-weight:700;color:var(--brand)" });
  next.addEventListener("click", () => ctx.setSelectedDate(addDaysISO(sel, 7)));
  const jump = el("button", { class: "tiny", text: "Today", style: "font-weight:700;color:var(--muted)" });
  jump.addEventListener("click", () => ctx.setSelectedDate(today));
  nav.appendChild(prev);
  nav.appendChild(jump);
  nav.appendChild(next);
  const wrap = el("div");
  wrap.appendChild(nav);
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
  const earned = creditsForRatio(ratio);
  chips.appendChild(el("span", { class: "hero-chip", text: earned ? `💰 +HK$${earned} today` : "💰 HK$0 today" }));
  const last = getLastEntry(date);
  if (last) {
    const t = new Date(last).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    chips.appendChild(el("span", { class: "hero-chip", text: `🕒 ${t}` }));
  }
  info.appendChild(chips);
  hero.appendChild(info);
  return hero;
}

function gamifySummary(ctx, date) {
  const s = computeStats();
  const card = el("button", { class: "gamify-strip" });
  card.addEventListener("click", () => ctx.goTo("rewards"));
  const lv = el("div", { class: "gs-level" }, [
    el("div", { class: "gs-badge", text: `L${s.level.level}` }),
    el("div", {}, [
      el("div", { class: "gs-identity", text: s.level.identity }),
      el("div", { class: "gs-xpbar" }, [el("i", { style: `width:${Math.round(s.level.progress * 100)}%` })]),
    ]),
  ]);
  const stats = el("div", { class: "gs-stats" }, [
    el("div", {}, [el("div", { class: "gs-v", text: `HK$${s.balance}` }), el("div", { class: "gs-l", text: "credits" })]),
    el("div", {}, [el("div", { class: "gs-v", text: `🔥${s.longest100}` }), el("div", { class: "gs-l", text: "100% streak" })]),
  ]);
  card.appendChild(lv);
  card.appendChild(stats);
  return card;
}

function habitRow(ctx, habit, date, isOff = false) {
  const complete = isComplete(habit, date);
  const row = el("div", { class: "habit-row" + (complete ? " done" : "") + (isOff ? " off" : "") });
  row.style.setProperty("--habit-color", habit.color);

  row.appendChild(el("div", { class: "habit-ico", text: habit.icon }));

  const main = el("div", { class: "habit-main" });
  main.appendChild(el("div", { class: "habit-name", text: habit.name }));
  const streak = currentStreak(habit, date);
  const sub = el("div", { class: "habit-sub" });
  const subText = habit.type === "count"
    ? `${getRecord(date, habit.id)}/${habit.target} ${habit.unit || ""}`.trim()
    : freqLabel(habit);
  sub.appendChild(el("span", { text: subText }));
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

// -------- Inline journal (mood + score + reflection) --------
function journalCard(ctx, date) {
  const note = getNote(date);
  const card = el("div", { class: "card card-pad journal-card", style: "margin-top:14px" });

  const head = el("div", { class: "row-between" });
  head.appendChild(el("div", { style: "font-weight:800;font-size:15px", text: "📝 Daily journal" }));
  if (note.updatedAt) {
    const t = new Date(note.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    head.appendChild(el("span", { class: "tiny", text: `Updated ${t}` }));
  }
  card.appendChild(head);

  // capture current inputs so switching mood/score keeps typed text
  const read = () => ({
    text: ta.value.trim(),
    mood: selMood,
    score: selScore,
  });
  const save = () => { setNote(date, read()); };

  // Mood
  let selMood = note.mood;
  const moodRow = el("div", { class: "mood-row", style: "margin-top:10px" });
  MOOD_LIST.forEach((emo, i) => {
    const b = el("button", { type: "button", text: emo, class: selMood === i ? "sel" : "" });
    b.addEventListener("click", () => {
      selMood = selMood === i ? null : i;
      Array.from(moodRow.children).forEach((c) => c.classList.remove("sel"));
      if (selMood != null) b.classList.add("sel");
      save();
    });
    moodRow.appendChild(b);
  });
  card.appendChild(labeled("How do you feel?", moodRow));

  // Score slider 0..10
  let selScore = note.score;
  const scoreLabel = el("span", { class: "tiny", style: "color:var(--brand);font-weight:800", text: selScore != null ? `${selScore}/10` : "—" });
  const slider = el("input", { type: "range", min: "0", max: "10", step: "1", value: String(selScore ?? 0), class: "score-slider" });
  slider.addEventListener("input", () => { scoreLabel.textContent = Number(slider.value) === 0 ? "—" : `${slider.value}/10`; });
  slider.addEventListener("change", () => {
    const v = Number(slider.value);
    selScore = v === 0 ? null : v;
    save();
  });
  const scoreHead = el("div", { class: "row-between" }, [el("span", { class: "tiny", style: "font-weight:700;color:var(--muted)", text: "Day score" }), scoreLabel]);
  card.appendChild(el("div", { class: "field", style: "margin:12px 0 6px" }, [scoreHead, slider]));

  // Text
  const ta = el("textarea", { placeholder: "Write your reflection for the day…", maxlength: "1000" });
  ta.value = note.text || "";
  ta.addEventListener("blur", save);
  card.appendChild(labeled("Reflection", ta));

  const actions = el("div", { style: "display:flex;gap:8px;margin-top:6px" });
  const saveBtn = el("button", { class: "btn btn-primary", style: "flex:1", text: "Save entry" });
  saveBtn.addEventListener("click", () => { save(); ctx.toast("Journal saved"); });
  actions.appendChild(saveBtn);
  if (note.text || note.mood != null || note.score != null) {
    const del = el("button", { class: "btn btn-danger", text: "Delete" });
    del.addEventListener("click", () => { deleteNote(date); ctx.toast("Journal entry removed"); });
    actions.appendChild(del);
  }
  card.appendChild(actions);
  return card;
}

function labeled(text, control) {
  return el("div", { class: "field", style: "margin-bottom:10px" }, [
    el("label", { text, style: "margin-bottom:6px" }), control,
  ]);
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
