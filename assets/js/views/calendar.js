// Calendar view: month / quarter grids with swipe + year navigation, and a
// merged heat that can be coloured by habit completion, mood, or day score.
import { el, iso, todayISO, parseISO, monthName, monthShort, daysInMonth, dowLetter } from "../utils.js";
import {
  activeHabits, getHabit, isScheduled, isComplete, dayCompletion, dayProgress,
  currentStreak, bestStreak, getMood, getScore, moodEmoji,
} from "../store.js";
import { heatColor, heatLegend } from "../charts.js";

const MOOD_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

export function topbarFor() { return { title: "Calendar", sub: "Consistency, mood & score" }; }

export function render(ctx) {
  const view = el("div", { class: "view" });
  if (ctx.state.calYear == null) {
    const now = parseISO(todayISO());
    ctx.state.calYear = now.getFullYear();
    ctx.state.calMonth = now.getMonth();
  }
  if (!ctx.state.calMode) ctx.state.calMode = "month";
  if (!ctx.state.calMetric) ctx.state.calMetric = "completion";

  // Month / Quarter toggle
  const modeSeg = el("div", { class: "segmented" });
  [["month", "Month"], ["quarter", "Quarter"]].forEach(([id, label]) => {
    const b = el("button", { text: label, class: ctx.state.calMode === id ? "active" : "" });
    b.addEventListener("click", () => { ctx.state.calMode = id; ctx.render(); });
    modeSeg.appendChild(b);
  });
  view.appendChild(modeSeg);

  // Habit selector
  view.appendChild(habitSelector(ctx));

  // Colour-by selector (only in all-habits mode)
  if (!isSpecificHabit(ctx)) view.appendChild(metricSelector(ctx));

  // Navigation header (month/quarter title + year)
  view.appendChild(navHeader(ctx));

  // Grid(s)
  if (ctx.state.calMode === "quarter") view.appendChild(quarterGrids(ctx));
  else view.appendChild(monthCard(ctx));

  // Stats
  view.appendChild(monthStats(ctx));
  return view;
}

function isSpecificHabit(ctx) {
  return ctx.state.calHabitId && ctx.state.calHabitId !== "all";
}
function selectedHabit(ctx) {
  return isSpecificHabit(ctx) ? getHabit(ctx.state.calHabitId) : null;
}

function habitSelector(ctx) {
  const wrap = el("div", { style: "overflow-x:auto;margin:2px 0 8px" });
  const row = el("div", { style: "display:flex;gap:8px;padding-bottom:4px" });
  const mkChip = (label, id) => {
    const active = (ctx.state.calHabitId || "all") === (id || "all");
    const chip = el("button", {
      class: "cal-chip" + (active ? " active" : ""),
      text: label,
    });
    chip.addEventListener("click", () => { ctx.state.calHabitId = id; ctx.render(); });
    return chip;
  };
  row.appendChild(mkChip("All habits", "all"));
  activeHabits().forEach((h) => row.appendChild(mkChip(`${h.icon} ${h.name}`, h.id)));
  wrap.appendChild(row);
  return wrap;
}

function metricSelector(ctx) {
  const seg = el("div", { class: "segmented", style: "margin:0 0 12px" });
  [["completion", "Completion"], ["mood", "Mood"], ["score", "Score"]].forEach(([id, label]) => {
    const b = el("button", { text: label, class: ctx.state.calMetric === id ? "active" : "" });
    b.addEventListener("click", () => { ctx.state.calMetric = id; ctx.render(); });
    seg.appendChild(b);
  });
  return seg;
}

function navHeader(ctx) {
  const { calYear: year, calMonth: month, calMode: mode } = ctx.state;
  const head = el("div", { class: "cal-head" });
  const prev = el("button", { class: "icon-btn", text: "‹" });
  prev.addEventListener("click", () => shift(ctx, -1));
  const next = el("button", { class: "icon-btn", text: "›" });
  next.addEventListener("click", () => shift(ctx, 1));

  const title = mode === "quarter"
    ? `Q${Math.floor(month / 3) + 1} · ${year}`
    : `${monthName(month)} ${year}`;
  const center = el("div", { style: "display:flex;flex-direction:column;align-items:center;gap:4px" }, [
    el("div", { class: "cal-title", text: title }),
    yearStepper(ctx),
  ]);
  head.appendChild(prev);
  head.appendChild(center);
  head.appendChild(next);
  return head;
}

function yearStepper(ctx) {
  const row = el("div", { style: "display:flex;align-items:center;gap:10px" });
  const back = el("button", { class: "tiny", style: "font-weight:800;color:var(--brand)", text: "◀" });
  back.addEventListener("click", () => { ctx.state.calYear--; ctx.render(); });
  const fwd = el("button", { class: "tiny", style: "font-weight:800;color:var(--brand)", text: "▶" });
  fwd.addEventListener("click", () => { ctx.state.calYear++; ctx.render(); });
  row.appendChild(back);
  row.appendChild(el("span", { class: "tiny", style: "font-weight:700", text: String(ctx.state.calYear) }));
  row.appendChild(fwd);
  return row;
}

function shift(ctx, delta) {
  const step = ctx.state.calMode === "quarter" ? 3 : 1;
  let m = ctx.state.calMonth + delta * step;
  let y = ctx.state.calYear;
  while (m < 0) { m += 12; y--; }
  while (m > 11) { m -= 12; y++; }
  ctx.state.calMonth = m;
  ctx.state.calYear = y;
  ctx.render();
}

function addSwipe(node, ctx) {
  let x0 = null;
  node.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  node.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 55) shift(ctx, dx < 0 ? 1 : -1);
    x0 = null;
  }, { passive: true });
}

function monthCard(ctx) {
  const { calYear: year, calMonth: month } = ctx.state;
  const habit = selectedHabit(ctx);
  const card = el("div", { class: "card card-pad" });
  addSwipe(card, ctx);

  const dowRow = el("div", { class: "cal-dow" });
  for (let i = 0; i < 7; i++) dowRow.appendChild(el("span", { text: dowLetter(i) }));
  card.appendChild(dowRow);

  const grid = el("div", { class: "cal-grid" });
  const first = new Date(year, month, 1);
  for (let i = 0; i < first.getDay(); i++) grid.appendChild(el("div", { class: "cal-cell empty" }));
  const total = daysInMonth(year, month);
  const today = todayISO();
  for (let d = 1; d <= total; d++) {
    grid.appendChild(dayCell(ctx, iso(new Date(year, month, d)), d, habit, today, true));
  }
  card.appendChild(grid);
  card.appendChild(legendFor(ctx));
  return card;
}

function quarterGrids(ctx) {
  const { calYear: year, calMonth: month } = ctx.state;
  const habit = selectedHabit(ctx);
  const q = Math.floor(month / 3);
  const wrap = el("div");
  addSwipe(wrap, ctx);
  const today = todayISO();
  for (let mi = q * 3; mi < q * 3 + 3; mi++) {
    const card = el("div", { class: "card card-pad", style: "margin-bottom:10px" });
    card.appendChild(el("div", { style: "font-weight:800;font-size:14px;margin-bottom:8px", text: `${monthName(mi)} ${year}` }));
    const dowRow = el("div", { class: "cal-dow" });
    for (let i = 0; i < 7; i++) dowRow.appendChild(el("span", { text: dowLetter(i) }));
    card.appendChild(dowRow);
    const grid = el("div", { class: "cal-grid" });
    const first = new Date(year, mi, 1);
    for (let i = 0; i < first.getDay(); i++) grid.appendChild(el("div", { class: "cal-cell empty" }));
    const total = daysInMonth(year, mi);
    for (let d = 1; d <= total; d++) {
      grid.appendChild(dayCell(ctx, iso(new Date(year, mi, d)), d, habit, today, false));
    }
    card.appendChild(grid);
    wrap.appendChild(card);
  }
  wrap.appendChild(legendFor(ctx));
  return wrap;
}

function dayCell(ctx, dISO, dayNum, habit, today, detailed) {
  const cell = el("div", { class: "cal-cell" });
  const isFuture = dISO > today;
  if (isFuture) cell.classList.add("future");
  if (dISO === today) cell.classList.add("today");

  const metric = ctx.state.calMetric;
  let bg = "";
  let useWhite = false;

  if (!isFuture) {
    if (habit) {
      if (!isScheduled(habit, dISO)) {
        cell.style.background = "transparent";
        cell.style.border = "1px dashed var(--line)";
      } else if (isComplete(habit, dISO)) {
        bg = habit.color; useWhite = true;
      }
    } else if (metric === "mood") {
      const m = getMood(dISO);
      if (m != null) { bg = MOOD_COLORS[m]; useWhite = m >= 3; }
    } else if (metric === "score") {
      const sc = getScore(dISO);
      if (sc != null) { bg = heatColor(sc / 10); useWhite = sc >= 7; }
    } else {
      const ratio = dayProgress(dISO);
      if (ratio > 0) { bg = heatColor(ratio); useWhite = ratio >= 0.66; }
    }
  }
  if (bg) { cell.style.background = bg; cell.style.borderColor = "transparent"; }

  cell.appendChild(el("div", { text: String(dayNum), style: useWhite ? "color:#fff" : "" }));

  // overlays: mood emoji + score/fraction in detailed month view
  if (detailed && !isFuture && !habit) {
    if (metric === "completion") {
      const { done, total } = dayCompletion(dISO);
      const mood = getMood(dISO);
      if (mood != null) cell.appendChild(el("div", { class: "cal-emoji", text: moodEmoji(mood) }));
      else if (total) cell.appendChild(el("div", { class: "fill-badge", style: useWhite ? "color:rgba(255,255,255,.85)" : "", text: `${done}/${total}` }));
    } else if (metric === "score") {
      const sc = getScore(dISO);
      if (sc != null) cell.appendChild(el("div", { class: "fill-badge", style: useWhite ? "color:rgba(255,255,255,.9)" : "", text: `${sc}` }));
    } else if (metric === "mood") {
      const m = getMood(dISO);
      if (m != null) cell.appendChild(el("div", { class: "cal-emoji", text: moodEmoji(m) }));
    }
  }

  cell.addEventListener("click", () => {
    if (isFuture) { ctx.toast("That day hasn't happened yet"); return; }
    ctx.setSelectedDate(dISO);
    ctx.goTo("today");
  });
  return cell;
}

function legendFor(ctx) {
  if (isSpecificHabit(ctx)) return heatLegend();
  if (ctx.state.calMetric === "mood") {
    const wrap = el("div", { class: "heat-legend" }, [el("span", { text: "Low" })]);
    MOOD_COLORS.forEach((c) => { const b = el("span", { class: "box" }); b.style.background = c; wrap.appendChild(b); });
    wrap.appendChild(el("span", { text: "High" }));
    return wrap;
  }
  return heatLegend();
}

function monthStats(ctx) {
  const { calYear: year, calMonth: month, calMode: mode } = ctx.state;
  const habit = selectedHabit(ctx);
  const today = todayISO();
  const tdY = parseISO(today).getFullYear();
  const tdM = parseISO(today).getMonth();

  const monthsToScan = mode === "quarter"
    ? [0, 1, 2].map((i) => Math.floor(month / 3) * 3 + i)
    : [month];

  let doneDays = 0, activeDays = 0, perfect = 0, moodSum = 0, moodN = 0, scoreSum = 0, scoreN = 0;
  monthsToScan.forEach((mi) => {
    const lastDay = (year === tdY && mi === tdM) ? parseISO(today).getDate()
      : (year > tdY || (year === tdY && mi > tdM)) ? 0 : daysInMonth(year, mi);
    for (let d = 1; d <= lastDay; d++) {
      const dISO = iso(new Date(year, mi, d));
      if (habit) {
        if (!isScheduled(habit, dISO)) continue;
        activeDays++;
        if (isComplete(habit, dISO)) doneDays++;
      } else {
        const { done, total, ratio } = dayCompletion(dISO);
        if (total) { activeDays++; if (done > 0) doneDays++; if (ratio >= 1) perfect++; }
      }
      const m = getMood(dISO); if (m != null) { moodSum += m; moodN++; }
      const sc = getScore(dISO); if (sc != null) { scoreSum += sc; scoreN++; }
    }
  });
  const rate = activeDays ? Math.round((doneDays / activeDays) * 100) : 0;

  const grid = el("div", { class: "stat-grid", style: "margin-top:14px" });
  grid.appendChild(statTile("📈", "Completion", `${rate}%`, mode === "quarter" ? "this quarter" : "this month"));
  if (habit) {
    grid.appendChild(statTile("🔥", "Current streak", String(currentStreak(habit, today)), "days"));
    grid.appendChild(statTile("🏆", "Best streak", String(bestStreak(habit)), "days"));
    grid.appendChild(statTile("✅", "Days done", String(doneDays), `of ${activeDays}`));
  } else {
    grid.appendChild(statTile("⭐", "Perfect days", String(perfect), "all done"));
    grid.appendChild(statTile("😊", "Avg mood", moodN ? moodEmoji(Math.round(moodSum / moodN)) : "—", moodN ? `${moodN} logged` : ""));
    grid.appendChild(statTile("📖", "Avg score", scoreN ? (scoreSum / scoreN).toFixed(1) : "—", scoreN ? "of 10" : ""));
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
