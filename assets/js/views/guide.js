// Guide view: Self-Discipline OS content + habit management + data/settings.
import { el } from "../utils.js";
import { activeHabits, freqLabel, reorderHabit, exportData, importData, clearAllData, getSettings, setSetting } from "../store.js";

export function topbarFor() { return { title: "Guide", sub: "Self-Discipline OS" }; }

export function render(ctx) {
  const view = el("div", { class: "view" });

  // Hero
  const hero = el("div", { class: "guide-hero" });
  hero.appendChild(el("div", { class: "eyebrow", text: "Practical operating system" }));
  hero.appendChild(el("h2", { text: "Self-Discipline Outside Office Hours" }));
  hero.appendChild(el("p", { text: "Discipline should not depend on mood. Build a system that makes the right action easier than the wrong one." }));
  const pills = el("div", { class: "guide-pills" });
  ["Energy-aware routine", "Small versions", "Streak evidence", "Bible time"].forEach((t) => pills.appendChild(el("span", { text: t })));
  hero.appendChild(pills);
  view.appendChild(hero);

  // Manage habits
  view.appendChild(manageBlock(ctx));

  // Four levers
  view.appendChild(leversBlock());

  // Weekday rhythm
  view.appendChild(rhythmBlock());

  // Low-energy protocol
  view.appendChild(rescueBlock());

  // Resources
  view.appendChild(resourceBlock());

  // Data & settings
  view.appendChild(dataBlock(ctx));

  view.appendChild(el("p", { class: "tiny center", style: "margin:22px 6px 0", text: "All data is stored locally in this browser only. Export a backup to keep it safe." }));
  return view;
}

function block(title, sub) {
  const b = el("div", { class: "guide-block" });
  b.appendChild(el("h3", { text: title }));
  if (sub) b.appendChild(el("div", { class: "sub", text: sub }));
  return b;
}

function manageBlock(ctx) {
  const b = block("Manage habits", "Reorder, edit, or add new habits.");
  const habits = activeHabits();
  habits.forEach((h, idx) => {
    const row = el("div", { class: "manage-row" });
    row.appendChild(el("div", { class: "habit-ico", style: `--habit-color:${h.color};background:color-mix(in srgb, ${h.color} 16%, var(--card))`, text: h.icon }));
    const main = el("div", { class: "m-main" });
    main.appendChild(el("div", { class: "m-name", text: h.name }));
    main.appendChild(el("div", { class: "m-sub", text: `${h.type === "count" ? `Goal ${h.target} ${h.unit || ""}` : "Yes / No"} · ${freqLabel(h)}` }));
    row.appendChild(main);
    const up = el("button", { class: "icon-btn", text: "↑", style: "width:34px;height:34px;font-size:15px" + (idx === 0 ? ";opacity:.35" : "") });
    up.addEventListener("click", () => reorderHabit(h.id, -1));
    const down = el("button", { class: "icon-btn", text: "↓", style: "width:34px;height:34px;font-size:15px" + (idx === habits.length - 1 ? ";opacity:.35" : "") });
    down.addEventListener("click", () => reorderHabit(h.id, 1));
    const edit = el("button", { class: "m-edit", text: "Edit" });
    edit.addEventListener("click", () => ctx.editHabit(h));
    row.appendChild(up);
    row.appendChild(down);
    row.appendChild(edit);
    b.appendChild(row);
  });
  const add = el("button", { class: "btn btn-ghost btn-block", text: "+ Add new habit", style: "margin-top:6px" });
  add.addEventListener("click", () => ctx.addHabit());
  b.appendChild(add);
  return b;
}

function leversBlock() {
  const b = block("The four discipline levers", "Use these as a checklist before adding any new habit.");
  const levers = [
    ["1", "Make it obvious", "Put the Bible, notebook, shoes, water, or task list where you cannot miss it.", "#2563eb"],
    ["2", "Make it easy", "Begin with a small version: 10 min Bible, 25 min focus, 10 min walk.", "#059669"],
    ["3", "Make it attractive", "Pair effort with something pleasant: coffee, clean desk, music after.", "#ea580c"],
    ["4", "Make it satisfying", "Track the streak. Small visible wins train identity faster than intention.", "#7c3aed"],
  ];
  levers.forEach(([n, t, p, c]) => {
    const row = el("div", { class: "lever" });
    row.appendChild(el("div", { class: "num", style: `background:${c}`, text: n }));
    row.appendChild(el("div", {}, [el("h4", { text: t }), el("p", { text: p })]));
    b.appendChild(row);
  });
  return b;
}

function rhythmBlock() {
  const b = block("Recommended weekday rhythm", "Work 9–6, leave home 8:15, arrive 7:00 PM.");
  const morning = [
    ["6:30", "Wake + water", "No phone. Open curtains. Drink water.", "must"],
    ["6:35", "Bible time + prayer", "Read a short passage. Write one sentence.", "must"],
    ["6:55", "Light movement", "Walk, stretch, push-ups, or mobility.", "light"],
    ["7:15", "Focus sprint", "25–35 min on one meaningful task. No tabs.", "must"],
    ["8:15", "Leave home", "Commute. Audio learning only if it doesn’t drain you.", ""],
  ];
  const evening = [
    ["7:00", "Arrive + decompress", "Change clothes. Water. 10 min no phone.", "light"],
    ["7:30", "Dinner / recovery", "Do not start hard work while hungry. Energy first.", "must"],
    ["8:30", "One focus block", "25–60 min. One defined output, not open-ended.", "must"],
    ["9:30", "Shutdown", "Write tomorrow’s first task. Close screens.", "stop"],
    ["10:45", "Sleep target", "Earlier sleep is tomorrow’s discipline investment.", "must"],
  ];
  b.appendChild(el("div", { style: "font-weight:800;font-size:13px;margin:6px 0 8px;color:var(--muted)", text: "Morning" }));
  morning.forEach((s) => b.appendChild(slot(s)));
  b.appendChild(el("div", { style: "font-weight:800;font-size:13px;margin:14px 0 8px;color:var(--muted)", text: "After work" }));
  evening.forEach((s) => b.appendChild(slot(s)));
  return b;
}

function slot([time, title, desc, badge]) {
  const s = el("div", { class: "slot" });
  s.appendChild(el("div", { class: "stime", text: time }));
  s.appendChild(el("div", {}, [el("h4", { text: title }), el("p", { text: desc })]));
  const label = badge || "fixed";
  s.appendChild(el("div", { class: "pill-badge " + badge, text: label }));
  return s;
}

function rescueBlock() {
  const b = block("Low-energy protocol", "When self-doubt appears, shrink the action. Do not debate.");
  const box = el("div", { class: "rescue" });
  box.appendChild(el("h4", { text: "The 10-minute rescue rule" }));
  const grid = el("div", { class: "rescue-grid" });
  [
    ["1. Name the state", "“Low energy. Not failure.”"],
    ["2. Reduce the task", "Only 10 minutes. No heroic target."],
    ["3. Start with environment", "Open file, clear desk, set timer."],
    ["4. End with evidence", "Record one completed vote for discipline."],
  ].forEach(([t, p]) => grid.appendChild(el("div", {}, [el("strong", { text: t }), document.createTextNode(p)])));
  box.appendChild(grid);
  b.appendChild(box);
  return b;
}

function resourceBlock() {
  const b = block("Resource library", "Trusted references behind this system.");
  const res = [
    ["Book / habits", "Build tiny systems", "https://jamesclear.com/atomic-habits-summary"],
    ["Book / focus", "Protect deep work", "https://asana.com/resources/what-is-deep-work"],
    ["Science", "Understand willpower", "https://med.stanford.edu/news/insights/2011/12/a-conversation-about-the-science-of-willpower.html"],
    ["Sleep", "Match energy timing", "https://www.sleepfoundation.org/how-sleep-works/chronotypes"],
    ["Routine", "Design mornings", "https://www.psychologytoday.com/us/blog/tracking-wonder/201702/create-a-morning-routine-that-works-for-you"],
    ["Schedule", "Set hard boundaries", "https://calnewport.com/fixed-schedule-productivity-how-i-accomplish-a-large-amount-of-work-in-a-small-number-of-work-hours/"],
  ];
  res.forEach(([k, t, url]) => {
    const row = el("div", { class: "resource-row" });
    row.appendChild(el("div", {}, [el("div", { class: "kicker", text: k }), el("h4", { text: t })]));
    row.appendChild(el("a", { href: url, target: "_blank", rel: "noopener", text: "Open ›" }));
    b.appendChild(row);
  });
  return b;
}

function dataBlock(ctx) {
  const b = block("Data & settings", "Your records live in this browser.");
  const settings = getSettings();

  // theme toggle
  const themeRow = el("div", { class: "manage-row" });
  themeRow.appendChild(el("div", { class: "habit-ico", text: "🌗" }));
  themeRow.appendChild(el("div", { class: "m-main" }, [
    el("div", { class: "m-name", text: "Dark mode" }),
    el("div", { class: "m-sub", text: "Switch the app theme" }),
  ]));
  const toggle = el("button", { class: "m-edit", text: settings.theme === "dark" ? "On" : "Off" });
  toggle.addEventListener("click", () => {
    const next = getSettings().theme === "dark" ? "light" : "dark";
    setSetting("theme", next);
    document.documentElement.setAttribute("data-theme", next);
    toggle.textContent = next === "dark" ? "On" : "Off";
    ctx.toast(next === "dark" ? "Dark mode on" : "Light mode on");
  });
  themeRow.appendChild(toggle);
  b.appendChild(themeRow);

  // export / import / reset
  const actions = el("div", { style: "display:flex;gap:8px;margin-top:8px" });
  const exp = el("button", { class: "btn btn-soft", style: "flex:1", text: "⬇ Export" });
  exp.addEventListener("click", () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: `momentum-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    ctx.toast("Backup exported");
  });
  const imp = el("button", { class: "btn btn-soft", style: "flex:1", text: "⬆ Import" });
  const fileInput = el("input", { type: "file", accept: "application/json", style: "display:none" });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { importData(reader.result); ctx.toast("Backup imported"); ctx.render(); }
      catch (e) { ctx.toast("Invalid backup file"); }
    };
    reader.readAsText(file);
  });
  imp.addEventListener("click", () => fileInput.click());
  actions.appendChild(exp);
  actions.appendChild(imp);
  b.appendChild(actions);
  b.appendChild(fileInput);

  const reset = el("button", { class: "btn btn-danger btn-block", style: "margin-top:8px", text: "Reset all data" });
  reset.addEventListener("click", () => {
    if (confirm("Reset all habits and records to defaults? This cannot be undone.")) {
      clearAllData(); ctx.toast("Data reset"); ctx.render();
    }
  });
  b.appendChild(reset);
  return b;
}
