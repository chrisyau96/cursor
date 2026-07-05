// Settings view: appearance, Google Drive sync, data backup, habit management,
// and the Self-Discipline Operating System guide.
import { el } from "../utils.js";
import {
  activeHabits, freqLabel, reorderHabit, exportData, importData, clearAllData,
  getSettings, setSetting,
} from "../store.js";
import {
  driveStatus, connectDrive, disconnectDrive, saveToDrive, restoreFromDrive,
} from "../drive.js";

export function topbarFor() { return { title: "Settings", sub: "Personalise & back up" }; }

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme || "light");
}
export function applyFontSize(size) {
  const map = { sm: "14px", md: "16px", lg: "18px", xl: "20px" };
  document.documentElement.style.fontSize = map[size] || map.md;
}

export function render(ctx) {
  const view = el("div", { class: "view" });
  view.appendChild(appearanceBlock(ctx));
  view.appendChild(driveBlock(ctx));
  view.appendChild(dataBlock(ctx));
  view.appendChild(manageBlock(ctx));
  view.appendChild(guideBlock());
  view.appendChild(el("p", { class: "tiny center", style: "margin:22px 6px 0", text: "All data is stored locally in this browser. Connect Google Drive or export a backup to keep it safe." }));
  return view;
}

function block(title, sub) {
  const b = el("div", { class: "guide-block" });
  b.appendChild(el("h3", { text: title }));
  if (sub) b.appendChild(el("div", { class: "sub", text: sub }));
  return b;
}

// -------- Appearance --------
function appearanceBlock(ctx) {
  const b = block("Appearance", "Theme and text size.");
  const s = getSettings();

  const themeRow = el("div", { class: "manage-row" });
  themeRow.appendChild(el("div", { class: "habit-ico", text: "🌗" }));
  themeRow.appendChild(el("div", { class: "m-main" }, [
    el("div", { class: "m-name", text: "Dark mode" }),
    el("div", { class: "m-sub", text: "Switch the app theme" }),
  ]));
  const toggle = el("button", { class: "m-edit", text: s.theme === "dark" ? "On" : "Off" });
  toggle.addEventListener("click", () => {
    const next = getSettings().theme === "dark" ? "light" : "dark";
    setSetting("theme", next);
    applyTheme(next);
    toggle.textContent = next === "dark" ? "On" : "Off";
    ctx.toast(next === "dark" ? "Dark mode on" : "Light mode on");
  });
  themeRow.appendChild(toggle);
  b.appendChild(themeRow);

  b.appendChild(el("div", { class: "tiny", style: "font-weight:700;color:var(--muted);margin:12px 0 6px", text: "Font size" }));
  const seg = el("div", { class: "segmented", style: "margin:0" });
  [["sm", "Small"], ["md", "Medium"], ["lg", "Large"], ["xl", "Huge"]].forEach(([id, label]) => {
    const btn = el("button", { text: label, class: (getSettings().fontSize || "md") === id ? "active" : "" });
    btn.addEventListener("click", () => {
      setSetting("fontSize", id);
      applyFontSize(id);
      Array.from(seg.children).forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      ctx.toast(`Font size: ${label}`);
    });
    seg.appendChild(btn);
  });
  b.appendChild(seg);
  return b;
}

// -------- Google Drive sync --------
function driveBlock(ctx) {
  const b = block("Google Drive sync", "Back up and live-sync your records to your own Drive.");
  const s = getSettings();
  const st = driveStatus();

  const statusRow = el("div", { class: "card card-pad", style: "margin-bottom:10px" });
  const dot = el("span", { class: "sync-dot" + (st.connected ? " on" : "") });
  statusRow.appendChild(el("div", { class: "row-between" }, [
    el("div", { style: "display:flex;align-items:center;gap:8px" }, [dot, el("span", { style: "font-weight:700", text: st.connected ? "Connected" : "Not connected" })]),
    el("span", { class: "tiny", text: s.driveLastSync ? `Last sync ${new Date(s.driveLastSync).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "Never synced" }),
  ]));
  b.appendChild(statusRow);

  // client id
  const idInput = el("input", { type: "text", placeholder: "Your Google OAuth Client ID", value: s.driveClientId || "" });
  idInput.addEventListener("change", () => { setSetting("driveClientId", idInput.value.trim()); ctx.toast("Client ID saved"); });
  b.appendChild(el("div", { class: "field" }, [
    el("label", { text: "OAuth Client ID" }),
    idInput,
    el("div", { class: "tiny", style: "margin-top:6px", text: "Create one in Google Cloud Console → Credentials → OAuth client (Web). Add this site's origin to Authorized JavaScript origins. Scope used: drive.appdata (private app folder)." }),
  ]));

  const row1 = el("div", { style: "display:flex;gap:8px" });
  if (!st.connected) {
    const connect = el("button", { class: "btn btn-primary", style: "flex:1", text: "Connect Drive" });
    connect.addEventListener("click", async () => {
      try { await connectDrive(); ctx.render(); }
      catch (e) { ctx.toast(e.message || "Connection failed"); }
    });
    row1.appendChild(connect);
  } else {
    const save = el("button", { class: "btn btn-primary", style: "flex:1", text: "⬆ Save now" });
    save.addEventListener("click", () => saveToDrive(false));
    const restore = el("button", { class: "btn btn-soft", style: "flex:1", text: "⬇ Restore" });
    restore.addEventListener("click", async () => { await restoreFromDrive(); ctx.render(); });
    row1.appendChild(save);
    row1.appendChild(restore);
  }
  b.appendChild(row1);

  // auto sync toggle
  const autoRow = el("div", { class: "manage-row", style: "margin-top:10px" });
  autoRow.appendChild(el("div", { class: "habit-ico", text: "🔄" }));
  autoRow.appendChild(el("div", { class: "m-main" }, [
    el("div", { class: "m-name", text: "Auto live-sync" }),
    el("div", { class: "m-sub", text: "Upload to Drive after each edit" }),
  ]));
  const autoToggle = el("button", { class: "m-edit", text: s.driveAutoSync ? "On" : "Off" });
  autoToggle.addEventListener("click", () => {
    const next = !getSettings().driveAutoSync;
    setSetting("driveAutoSync", next);
    autoToggle.textContent = next ? "On" : "Off";
    ctx.toast(next ? "Auto-sync on" : "Auto-sync off");
    if (next && !driveStatus().connected) ctx.toast("Connect Drive to enable syncing");
  });
  autoRow.appendChild(autoToggle);
  b.appendChild(autoRow);

  if (st.connected) {
    const disc = el("button", { class: "btn btn-danger btn-block", style: "margin-top:8px", text: "Disconnect Drive" });
    disc.addEventListener("click", () => { disconnectDrive(); ctx.toast("Disconnected"); ctx.render(); });
    b.appendChild(disc);
  }
  return b;
}

// -------- Data backup --------
function dataBlock(ctx) {
  const b = block("Data & backup", "Export a file, import a backup, or reset.");
  const actions = el("div", { style: "display:flex;gap:8px" });
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
    if (confirm("Reset all habits, records, journal and rewards to defaults? This cannot be undone.")) {
      clearAllData(); ctx.toast("Data reset"); ctx.render();
    }
  });
  b.appendChild(reset);
  return b;
}

// -------- Manage habits --------
function manageBlock(ctx) {
  const b = block("Manage habits", "Reorder, edit, or add habits.");
  const habits = activeHabits();
  habits.forEach((h, idx) => {
    const row = el("div", { class: "manage-row" });
    row.appendChild(el("div", { class: "habit-ico", style: `--habit-color:${h.color};background:color-mix(in srgb, ${h.color} 16%, var(--card))`, text: h.icon }));
    row.appendChild(el("div", { class: "m-main" }, [
      el("div", { class: "m-name", text: h.name }),
      el("div", { class: "m-sub", text: `${h.type === "count" ? `Goal ${h.target} ${h.unit || ""}` : "Yes / No"} · ${freqLabel(h)}` }),
    ]));
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

// -------- Self-Discipline OS guide --------
function guideBlock() {
  const wrap = el("div");
  const hero = el("div", { class: "guide-hero", style: "margin-top:18px" });
  hero.appendChild(el("div", { class: "eyebrow", text: "Self-Discipline Operating System" }));
  hero.appendChild(el("h2", { text: "Discipline is system design" }));
  hero.appendChild(el("p", { text: "Make the right action easier than the wrong one. Small versions, energy-aware timing, and visible streaks." }));
  wrap.appendChild(hero);

  const levers = block("The four discipline levers", "A checklist before adding any habit.");
  [
    ["1", "Make it obvious", "Put the cue where you cannot miss it.", "#2563eb"],
    ["2", "Make it easy", "Begin with a small version.", "#059669"],
    ["3", "Make it attractive", "Pair effort with something pleasant.", "#ea580c"],
    ["4", "Make it satisfying", "Track the streak — visible wins train identity.", "#7c3aed"],
  ].forEach(([n, t, p, c]) => {
    levers.appendChild(el("div", { class: "lever" }, [
      el("div", { class: "num", style: `background:${c}`, text: n }),
      el("div", {}, [el("h4", { text: t }), el("p", { text: p })]),
    ]));
  });
  wrap.appendChild(levers);

  const rhythm = block("Weekday rhythm", "Work 9–6, leave 8:15, home 7:00 PM.");
  [
    ["6:30", "Wake + water", "No phone. Open curtains.", "must"],
    ["6:35", "Bible time", "Short passage + one sentence.", "must"],
    ["7:15", "Focus sprint", "25–35 min, one task.", "must"],
    ["8:30", "Evening focus block", "25–60 min, one output.", "must"],
    ["9:30", "Shutdown", "Prep tomorrow. Close screens.", "stop"],
  ].forEach(([time, title, desc, badge]) => {
    rhythm.appendChild(el("div", { class: "slot" }, [
      el("div", { class: "stime", text: time }),
      el("div", {}, [el("h4", { text: title }), el("p", { text: desc })]),
      el("div", { class: "pill-badge " + badge, text: badge }),
    ]));
  });
  wrap.appendChild(rhythm);

  const rescue = block("Low-energy protocol", "Shrink the action. Don’t debate.");
  const box = el("div", { class: "rescue" });
  box.appendChild(el("h4", { text: "The 10-minute rescue rule" }));
  const grid = el("div", { class: "rescue-grid" });
  [
    ["1. Name the state", "“Low energy. Not failure.”"],
    ["2. Reduce the task", "Only 10 minutes."],
    ["3. Start with environment", "Open file, set timer."],
    ["4. End with evidence", "One completed vote."],
  ].forEach(([t, p]) => grid.appendChild(el("div", {}, [el("strong", { text: t }), document.createTextNode(p)])));
  box.appendChild(grid);
  rescue.appendChild(box);
  wrap.appendChild(rescue);

  const res = block("Resource library", "References behind this system.");
  [
    ["Habits", "Build tiny systems", "https://jamesclear.com/atomic-habits-summary"],
    ["Focus", "Protect deep work", "https://asana.com/resources/what-is-deep-work"],
    ["Science", "Understand willpower", "https://med.stanford.edu/news/insights/2011/12/a-conversation-about-the-science-of-willpower.html"],
    ["Schedule", "Set hard boundaries", "https://calnewport.com/fixed-schedule-productivity-how-i-accomplish-a-large-amount-of-work-in-a-small-number-of-work-hours/"],
  ].forEach(([k, t, url]) => {
    res.appendChild(el("div", { class: "resource-row" }, [
      el("div", {}, [el("div", { class: "kicker", text: k }), el("h4", { text: t })]),
      el("a", { href: url, target: "_blank", rel: "noopener", text: "Open ›" }),
    ]));
  });
  wrap.appendChild(res);
  return wrap;
}
