// App controller: routing, sheet/toast host, and view rendering.
import { $, $$, el, todayISO } from "./utils.js";
import { load, subscribe, getSettings } from "./store.js";
import { habitFormSheet } from "./habitForm.js";

import * as today from "./views/today.js";
import * as calendar from "./views/calendar.js";
import * as reports from "./views/reports.js";
import * as guide from "./views/guide.js";

const views = { today, calendar, reports, guide };

const app = {
  state: {
    view: "today",
    selectedDate: todayISO(),
    calHabitId: "all",
    calYear: null,
    calMonth: null,
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
let toastTimer;
function toast(msg) {
  const t = el("div", { class: "toast", text: msg });
  toastHost.appendChild(t);
  clearTimeout(toastTimer);
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
}

// ---------- Wire up tabbar ----------
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.action === "add-habit") { ctx.addHabit(); return; }
    if (tab.dataset.view) goTo(tab.dataset.view);
  });
});

// scrolled shadow on topbar
viewHost.addEventListener("scroll", () => {
  topbar.classList.toggle("scrolled", viewHost.scrollTop > 4);
});

// re-render on store changes
subscribe(() => renderView());

// ---------- Init ----------
function init() {
  load();
  const theme = getSettings().theme;
  if (theme) document.documentElement.setAttribute("data-theme", theme);
  goTo("today");
}

init();
