// Reports view: weekly / monthly / yearly trends and stats.
import { el, iso, todayISO, parseISO, addDaysISO, startOfWeek, dowShort, dowLetter, monthShort } from "../utils.js";
import {
  activeHabits, dayCompletion, dayProgress, isScheduled, isComplete,
  currentStreak, bestStreak, totalCompletions, completionRate, getHabit,
  getMood, getScore, moodEmoji,
} from "../store.js";
import { barChart, lineChart, yearHeat, heatLegend } from "../charts.js";
import { computeStats } from "../gamify.js";

export function topbarFor() { return { title: "Reports", sub: "See your trends & results" }; }

export function render(ctx) {
  const view = el("div", { class: "view" });
  const range = ctx.state.reportRange || "weekly";

  const seg = el("div", { class: "segmented" });
  [["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"]].forEach(([id, label]) => {
    const b = el("button", { text: label, class: range === id ? "active" : "" });
    b.addEventListener("click", () => { ctx.state.reportRange = id; ctx.render(); });
    seg.appendChild(b);
  });
  view.appendChild(seg);

  if (activeHabits().length === 0) {
    view.appendChild(el("div", { class: "empty" }, [
      el("div", { class: "emoji", text: "📊" }),
      el("h3", { text: "No data yet" }),
      el("p", { text: "Add habits and check them off to unlock trend reports." }),
    ]));
    return view;
  }

  if (range === "weekly") renderWeekly(ctx, view);
  else if (range === "monthly") renderMonthly(ctx, view);
  else renderYearly(ctx, view);

  view.appendChild(moodScoreCard(range));
  view.appendChild(habitBreakdown(ctx, range));
  return view;
}

// Number of days back for each range's mood/score trend.
function rangeDays(range) { return range === "weekly" ? 7 : range === "monthly" ? 30 : 90; }

// Merged journal analytics: day score trend + average mood.
function moodScoreCard(range) {
  const today = todayISO();
  const n = rangeDays(range);
  const points = [];
  let moodSum = 0, moodN = 0, scoreSum = 0, scoreN = 0;
  for (let i = n - 1; i >= 0; i--) {
    const dISO = addDaysISO(today, -i);
    const sc = getScore(dISO);
    const m = getMood(dISO);
    if (sc != null) { scoreSum += sc; scoreN++; }
    if (m != null) { moodSum += m; moodN++; }
    const d = parseISO(dISO);
    points.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: sc != null ? sc / 10 : 0 });
  }
  const card = el("div", { class: "card chart-card", style: "margin-top:14px" });
  card.appendChild(el("div", { class: "row-between" }, [
    el("h3", { text: "Journal: mood & score" }),
    el("span", { class: "tiny", text: `${moodN ? moodEmoji(Math.round(moodSum / moodN)) : "—"} avg mood` }),
  ]));
  card.appendChild(el("div", { class: "chart-sub", text: scoreN ? `Average day score ${(scoreSum / scoreN).toFixed(1)}/10 · ${scoreN} entries` : "No journal scores yet — add one from Today." }));
  card.appendChild(lineChart(points, { color: "#059669" }));
  return card;
}

// ---------------- Weekly ----------------
function renderWeekly(ctx, view) {
  const today = todayISO();
  const start = startOfWeek(parseISO(today));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const dISO = iso(d);
    const { done, total } = dayCompletion(dISO);
    days.push({ dISO, dow: d.getDay(), done, total, ratio: total ? done / total : 0, future: dISO > today });
  }
  const weekDone = days.reduce((s, d) => s + d.done, 0);
  const weekTotal = days.reduce((s, d) => s + d.total, 0);
  const rate = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0;
  const best = days.filter((d) => !d.future).sort((a, b) => b.ratio - a.ratio)[0];
  const perfect = days.filter((d) => d.total && d.ratio >= 1).length;

  const stats = el("div", { class: "stat-grid" });
  stats.appendChild(statTile("📈", "Week completion", `${rate}%`, "so far"));
  stats.appendChild(statTile("✅", "Habits done", String(weekDone), `of ${weekTotal}`));
  stats.appendChild(statTile("⭐", "Perfect days", String(perfect), "this week"));
  stats.appendChild(statTile("🔥", "Longest 100%", String(computeStats().longest100), "day streak"));
  view.appendChild(stats);

  const chart = el("div", { class: "card chart-card", style: "margin-top:14px" });
  chart.appendChild(el("h3", { text: "Daily completion" }));
  chart.appendChild(el("div", { class: "chart-sub", text: "This week, Sunday to Saturday" }));
  chart.appendChild(barChart(
    days.map((d) => ({
      label: dowLetter(d.dow),
      value: d.future ? 0 : Math.round(d.ratio * 100),
      showVal: d.future ? "" : (d.total ? `${Math.round(d.ratio * 100)}%` : ""),
    })),
    { max: 100 },
  ));
  view.appendChild(chart);
}

// ---------------- Monthly ----------------
function renderMonthly(ctx, view) {
  const today = todayISO();
  const from = addDaysISO(today, -29);
  // stats over 30d
  let doneDays = 0, activeDays = 0, perfect = 0, sumRatio = 0;
  const points = [];
  for (let i = 29; i >= 0; i--) {
    const dISO = addDaysISO(today, -i);
    const { done, total, ratio } = dayCompletion(dISO);
    if (total) { activeDays++; if (done > 0) doneDays++; if (ratio >= 1) perfect++; sumRatio += ratio; }
    const d = parseISO(dISO);
    points.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: total ? ratio : 0 });
  }
  const avg = activeDays ? Math.round((sumRatio / activeDays) * 100) : 0;
  const totalDone = activeHabits().reduce((s, h) => {
    let c = 0; for (let i = 29; i >= 0; i--) { const dISO = addDaysISO(today, -i); if (isComplete(h, dISO)) c++; } return s + c;
  }, 0);

  const stats = el("div", { class: "stat-grid" });
  stats.appendChild(statTile("📈", "Avg completion", `${avg}%`, "30 days"));
  stats.appendChild(statTile("✅", "Total check-ins", String(totalDone), "this month"));
  stats.appendChild(statTile("⭐", "Perfect days", String(perfect), "of " + activeDays));
  stats.appendChild(statTile("🔥", "Longest 100%", String(computeStats().longest100), "day streak"));
  view.appendChild(stats);

  const chart = el("div", { class: "card chart-card", style: "margin-top:14px" });
  chart.appendChild(el("h3", { text: "Completion trend" }));
  chart.appendChild(el("div", { class: "chart-sub", text: "Daily completion rate over the last 30 days" }));
  chart.appendChild(lineChart(points));
  view.appendChild(chart);

  // weekly aggregate bars over the month
  const weeks = [];
  for (let w = 3; w >= 0; w--) {
    const wEnd = addDaysISO(today, -w * 7);
    const wStart = addDaysISO(wEnd, -6);
    let done = 0, total = 0;
    let dISO = wStart;
    while (dISO <= wEnd) { const dc = dayCompletion(dISO); done += dc.done; total += dc.total; dISO = addDaysISO(dISO, 1); }
    weeks.push({ label: w === 0 ? "This" : `-${w}w`, value: total ? Math.round((done / total) * 100) : 0 });
  }
  const wc = el("div", { class: "card chart-card", style: "margin-top:14px" });
  wc.appendChild(el("h3", { text: "Weekly comparison" }));
  wc.appendChild(el("div", { class: "chart-sub", text: "Completion rate per week" }));
  wc.appendChild(barChart(weeks.map((w) => ({ label: w.label, value: w.value, showVal: `${w.value}%` })), { max: 100 }));
  view.appendChild(wc);
}

// ---------------- Yearly ----------------
function renderYearly(ctx, view) {
  const today = todayISO();
  const td = parseISO(today);
  const year = td.getFullYear();
  const startISO = iso(new Date(year, 0, 1));

  // per-month completion
  const months = [];
  for (let m = 0; m < 12; m++) {
    const last = new Date(year, m + 1, 0).getDate();
    let done = 0, total = 0;
    for (let d = 1; d <= last; d++) {
      const dISO = iso(new Date(year, m, d));
      if (dISO > today) break;
      const dc = dayCompletion(dISO);
      done += dc.done; total += dc.total;
    }
    months.push({ label: monthShort(m)[0], value: total ? Math.round((done / total) * 100) : 0, showVal: "" });
  }
  let ytdDone = 0, ytdActive = 0, perfect = 0;
  let dISO = startISO;
  while (dISO <= today) {
    const dc = dayCompletion(dISO);
    if (dc.total) { ytdActive++; if (dc.done > 0) ytdDone++; if (dc.ratio >= 1) perfect++; }
    dISO = addDaysISO(dISO, 1);
  }
  const totalCheckins = activeHabits().reduce((s, h) => s + totalCompletions(h), 0);

  const stats = el("div", { class: "stat-grid" });
  stats.appendChild(statTile("📅", "Active days", String(ytdActive), `in ${year}`));
  stats.appendChild(statTile("⭐", "Perfect days", String(perfect), "all done"));
  stats.appendChild(statTile("✅", "Total check-ins", String(totalCheckins), "all time"));
  stats.appendChild(statTile("🔥", "Longest 100%", String(computeStats().longest100), "day streak"));
  view.appendChild(stats);

  const heatCard = el("div", { class: "card chart-card", style: "margin-top:14px" });
  heatCard.appendChild(el("h3", { text: `${year} activity` }));
  heatCard.appendChild(el("div", { class: "chart-sub", text: "Darker = more habits completed that day" }));
  heatCard.appendChild(yearHeat(startISO, today, (d) => dayProgress(d)));
  heatCard.appendChild(heatLegend());
  view.appendChild(heatCard);

  const monthChart = el("div", { class: "card chart-card", style: "margin-top:14px" });
  monthChart.appendChild(el("h3", { text: "Monthly completion" }));
  monthChart.appendChild(el("div", { class: "chart-sub", text: `Average completion per month in ${year}` }));
  monthChart.appendChild(barChart(months.map((m) => ({ label: m.label, value: m.value })), { max: 100 }));
  view.appendChild(monthChart);
}

// ---------------- Per-habit breakdown ----------------
function habitBreakdown(ctx, range) {
  const today = todayISO();
  const from = range === "weekly" ? iso(startOfWeek(parseISO(today)))
    : range === "monthly" ? addDaysISO(today, -29)
    : iso(new Date(parseISO(today).getFullYear(), 0, 1));

  const wrap = el("div");
  wrap.appendChild(el("div", { class: "section-title", style: "margin-top:22px" }, [el("h2", { text: "By habit" })]));
  const list = el("div", { class: "habit-list" });
  activeHabits().forEach((h) => {
    const rate = Math.round(completionRate(h, from, today) * 100);
    const row = el("div", { class: "manage-row" });
    row.appendChild(el("div", { class: "habit-ico", style: `--habit-color:${h.color};background:color-mix(in srgb, ${h.color} 16%, var(--card))`, text: h.icon }));
    const main = el("div", { class: "m-main" });
    main.appendChild(el("div", { class: "m-name", text: h.name }));
    main.appendChild(el("div", { class: "pbar", style: "margin-top:6px" }, [el("i", { style: `width:${rate}%;background:${h.color}` })]));
    row.appendChild(main);
    row.appendChild(el("div", { style: "text-align:right" }, [
      el("div", { style: `font-weight:800;color:${h.color}`, text: `${rate}%` }),
      el("div", { class: "tiny", text: `🔥 ${currentStreak(h, today)}` }),
    ]));
    row.addEventListener("click", () => import("./sheets.js").then((m) => m.habitDetailSheet(ctx, h)));
    list.appendChild(row);
  });
  wrap.appendChild(list);
  return wrap;
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
