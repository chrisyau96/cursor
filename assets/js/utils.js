// Small DOM + date helpers shared across the app.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k === "style") node.setAttribute("style", v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "dataset") {
      Object.assign(node.dataset, v);
    } else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export const uid = () =>
  "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// ---------- Dates ----------
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const dowShort = (i) => DOW_SHORT[i];
export const dowLetter = (i) => DOW_LETTER[i];
export const monthName = (i) => MONTHS[i];
export const monthShort = (i) => MONTHS_SHORT[i];

export function iso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISO(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => iso(new Date());

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addDaysISO(str, n) {
  return iso(addDays(parseISO(str), n));
}

export function startOfWeek(date) {
  // Week starts on Sunday to match the reference calendars.
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(aISO, bISO) {
  return Math.round((parseISO(bISO) - parseISO(aISO)) / 86400000);
}

export function prettyDate(dateISO) {
  const d = parseISO(dateISO);
  return `${DOW_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function relativeDay(dateISO) {
  const t = todayISO();
  if (dateISO === t) return "Today";
  if (dateISO === addDaysISO(t, -1)) return "Yesterday";
  if (dateISO === addDaysISO(t, 1)) return "Tomorrow";
  return prettyDate(dateISO);
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Escape user text before inserting as innerHTML.
export function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
