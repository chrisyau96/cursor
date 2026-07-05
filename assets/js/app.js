// App controller: routing, sheet/toast host, view rendering, settings gear,
// live clock, font-size, and Google Drive auto-sync wiring.
import { $, $$, el, todayISO } from "./utils.js";
import { load, subscribe, onChange, getSettings, setSetting } from "./store.js";
import { computeStats } from "./gamify.js";
import { habitFormSheet } from "./habitForm.js";
import { initDrive, scheduleAutoSync } from "./drive.js";

import * as today from "./views/today.js";
import * as calendar from "./views/calendar.js";
import * as reports from "./views/reports.js";
import * as rewards from "./views/rewards.js";
import * as settings from "./views/settings.js";
import { applyTheme, applyFontSize } from "./views/settings.js";

const views = { today, calendar, reports, rewards, settings };

const app = {
  state: {
    view: "today",
    selectedDate: todayISO(),
    calHabitId: "all",
    calYear: null,
    calMonth: null,
    calMode: "month",
    reportRange: "weekly",
  },
};

const viewHost = $("#viewHost");
const topbarTitle = $("#topbarTitle");
const topbarSub = $("#topbarSub");
const topbarActions = $("#topbarActions");
const topbar = $("#topbar");
const sheetHost = $("#sheetHost");
const sheetEl = $("#sheet");
const toastHost = $("#toastHost");

// ---------- Sheet ----------
function openSheet(contentNode) {
  sheetEl.innerHTML = "";
  sheetEl.appendChild(el("div", { class: "sheet-handle" }));
  sheetEl.appendChild(contentNode);
  sheetHost.hidden = false;
  sheetEl.scrollTop = 0;
}
function closeSheet() {
  sheetHost.hidden = true;
  sheetEl.innerHTML = "";
}
sheetHost.addEventListener("click", (e) => {
  if (e.target.dataset.close) closeSheet();
});

// ---------- Toast ----------
function toast(msg) {
  const t = el("div", { class: "toast", text: msg });
  toastHost.appendChild(t);
  setTimeout(() => {
    t.classList.add("out");
    setTimeout(() => t.remove(), 260);
  }, 1900);
}

// ---------- Context passed to views ----------
const ctx = {
  state: app.state,
  openSheet,
  closeSheet,
  toast,
  goTo,
  render: renderView,
  setSelectedDate(dateISO) {
    app.state.selectedDate = dateISO;
    if (app.state.view !== "today") goTo("today");
    else renderView();
  },
  addHabit() { habitFormSheet(openSheet, closeSheet, toast, null); },
  editHabit(habit) { habitFormSheet(openSheet, closeSheet, toast, habit); },
};

// ---------- Routing ----------
function goTo(viewName) {
  app.state.view = viewName;
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === viewName));
  viewHost.scrollTop = 0;
  renderView();
}

function renderView() {
  const mod = views[app.state.view] || views.today;
  const node = mod.render(ctx);
  viewHost.innerHTML = "";
  viewHost.appendChild(node);
  const bar = mod.topbarFor ? mod.topbarFor(ctx) : { title: app.state.view, sub: "" };
  topbarTitle.textContent = bar.title;
  topbarSub.textContent = bar.sub || "";
  renderTopbarActions();
}

function renderTopbarActions() {
  topbarActions.innerHTML = "";
  // level chip -> rewards
  const stats = computeStats();
  const chip = el("button", {
    class: "level-chip",
    title: `Level ${stats.level.level} · ${stats.level.identity}`,
  }, [
    el("span", { class: "lc-lvl", text: `L${stats.level.level}` }),
    el("span", { class: "lc-credit", text: `HK$${stats.balance}` }),
  ]);
  chip.addEventListener("click", () => goTo("rewards"));
  topbarActions.appendChild(chip);

  const gear = el("button", { class: "icon-btn", "aria-label": "Settings", text: "⚙️" });
  gear.addEventListener("click", () => goTo("settings"));
  topbarActions.appendChild(gear);
}

// ---------- Tabbar ----------
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.action === "add-habit") { ctx.addHabit(); return; }
    if (tab.dataset.view) goTo(tab.dataset.view);
  });
});

viewHost.addEventListener("scroll", () => {
  topbar.classList.toggle("scrolled", viewHost.scrollTop > 4);
});

subscribe(() => renderView());

// Auto-sync to Drive whenever data changes (if enabled + connected).
onChange(() => scheduleAutoSync());

// ---------- Live clock (updates the Today subtitle) ----------
function tickClock() {
  if (app.state.view === "today") {
    topbarSub.textContent = views.today.topbarFor(ctx).sub;
  }
}

// ---------- Init ----------
function init() {
  load();
  const s = getSettings();
  applyTheme(s.theme);
  applyFontSize(s.fontSize);
  initDrive(toast, () => renderView());
  goTo("today");
  setInterval(tickClock, 15000);
}

init();
