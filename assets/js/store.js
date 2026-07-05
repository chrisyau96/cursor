// Central data store: habits + daily records, persisted to localStorage.
import { uid, iso, todayISO, parseISO, addDaysISO, daysInMonth } from "./utils.js";

const STORAGE_KEY = "momentum.habits.v1";
const SETTINGS_KEY = "momentum.settings.v1";

export const PALETTE = [
  "#4f46e5", "#2563eb", "#0ea5e9", "#059669", "#16a34a",
  "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#7c3aed",
];

export const EMOJIS = [
  "✅", "💧", "📖", "🏃", "🧘", "💪", "🥗", "😴", "☀️", "🌙",
  "✍️", "📚", "🎯", "🧹", "💊", "🚶", "🎨", "🎸", "🧠", "🙏",
  "💻", "☕", "🚭", "💰", "📵", "🍎", "🦷", "🌱", "⏰", "🔥",
];

const MOODS = ["😞", "😕", "😐", "🙂", "😄"];
export const moodEmoji = (n) => MOODS[n] ?? "";
export const MOOD_LIST = MOODS;

// Default habits seeded from the Self-Discipline OS guide.
function defaultHabits() {
  const base = todayISO();
  const mk = (o) => ({
    id: uid(),
    name: o.name,
    icon: o.icon,
    color: o.color,
    type: o.type || "check",
    target: o.target || 1,
    unit: o.unit || "",
    freq: o.freq || { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
    category: o.category || "Routine",
    createdAt: base,
    order: o.order,
    archived: false,
  });
  return [
    mk({ name: "Wake on time", icon: "⏰", color: "#2563eb", order: 0, category: "Morning" }),
    mk({ name: "Bible time", icon: "🙏", color: "#7c3aed", order: 1, category: "Morning" }),
    mk({ name: "Light movement", icon: "🚶", color: "#16a34a", order: 2, category: "Health" }),
    mk({ name: "Morning focus sprint", icon: "🎯", color: "#ea580c", order: 3, category: "Focus" }),
    mk({ name: "Drink water", icon: "💧", color: "#0ea5e9", type: "count", target: 8, unit: "cups", order: 4, category: "Health" }),
    mk({ name: "Evening focus block", icon: "💻", color: "#4f46e5", order: 5, category: "Focus" }),
    mk({ name: "Shutdown routine", icon: "🌙", color: "#db2777", order: 6, category: "Evening" }),
    mk({ name: "Sleep target", icon: "😴", color: "#059669", order: 7, category: "Evening" }),
  ];
}

const store = {
  habits: [],
  // records[dateISO] = { [habitId]: number }
  records: {},
  // notes[dateISO] = { text, mood }
  notes: {},
};

let settings = { theme: "light", weekStart: 0 };

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn()); }

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      store.habits = Array.isArray(data.habits) ? data.habits : [];
      store.records = data.records || {};
      store.notes = data.notes || {};
    } else {
      store.habits = defaultHabits();
      seedDemoRecords();
      persist();
    }
  } catch (e) {
    console.error("Failed to load store", e);
    store.habits = defaultHabits();
  }
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) settings = { ...settings, ...JSON.parse(s) };
  } catch (e) { /* ignore */ }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    habits: store.habits,
    records: store.records,
    notes: store.notes,
  }));
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Give first-run users ~5 weeks of realistic history so reports look alive.
function seedDemoRecords() {
  const today = todayISO();
  for (let back = 1; back <= 34; back++) {
    const date = addDaysISO(today, -back);
    const dow = parseISO(date).getDay();
    for (const h of store.habits) {
      if (!isScheduled(h, date)) continue;
      // decay: more recent days a bit more consistent
      const base = 0.78 - back * 0.004;
      const weekendPenalty = dow === 0 || dow === 6 ? 0.12 : 0;
      const hit = Math.random() < base - weekendPenalty;
      if (!hit) continue;
      if (h.type === "count") {
        const val = Math.max(1, Math.round(h.target * (0.5 + Math.random() * 0.6)));
        setRecord(date, h.id, Math.min(val, h.target), false);
      } else {
        setRecord(date, h.id, 1, false);
      }
    }
  }
}

// ---------- Accessors ----------
export function getSettings() { return { ...settings }; }
export function setSetting(key, value) {
  settings[key] = value;
  persistSettings();
  emit();
}

export function activeHabits() {
  return store.habits
    .filter((h) => !h.archived)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function allHabits() { return store.habits.slice(); }
export function getHabit(id) { return store.habits.find((h) => h.id === id); }

export function addHabit(data) {
  const order = store.habits.length
    ? Math.max(...store.habits.map((h) => h.order ?? 0)) + 1
    : 0;
  const habit = {
    id: uid(),
    name: data.name.trim() || "New habit",
    icon: data.icon || "✅",
    color: data.color || PALETTE[0],
    type: data.type === "count" ? "count" : "check",
    target: data.type === "count" ? Math.max(1, Number(data.target) || 1) : 1,
    unit: data.unit || "",
    freq: data.freq || { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
    category: data.category || "Routine",
    createdAt: todayISO(),
    order,
    archived: false,
  };
  store.habits.push(habit);
  persist();
  emit();
  return habit;
}

export function updateHabit(id, data) {
  const h = getHabit(id);
  if (!h) return;
  Object.assign(h, {
    name: data.name.trim() || h.name,
    icon: data.icon || h.icon,
    color: data.color || h.color,
    type: data.type === "count" ? "count" : "check",
    target: data.type === "count" ? Math.max(1, Number(data.target) || 1) : 1,
    unit: data.unit ?? h.unit,
    freq: data.freq || h.freq,
    category: data.category || h.category,
  });
  persist();
  emit();
}

export function deleteHabit(id) {
  store.habits = store.habits.filter((h) => h.id !== id);
  for (const date of Object.keys(store.records)) {
    if (store.records[date]) delete store.records[date][id];
  }
  persist();
  emit();
}

export function reorderHabit(id, dir) {
  const list = activeHabits();
  const idx = list.findIndex((h) => h.id === id);
  const swap = idx + dir;
  if (idx < 0 || swap < 0 || swap >= list.length) return;
  const a = list[idx], b = list[swap];
  const tmp = a.order; a.order = b.order; b.order = tmp;
  persist();
  emit();
}

// ---------- Records ----------
export function getRecord(dateISO, habitId) {
  return store.records[dateISO]?.[habitId] ?? 0;
}

export function setRecord(dateISO, habitId, value, doEmit = true) {
  if (!store.records[dateISO]) store.records[dateISO] = {};
  if (value <= 0) delete store.records[dateISO][habitId];
  else store.records[dateISO][habitId] = value;
  if (Object.keys(store.records[dateISO]).length === 0) delete store.records[dateISO];
  if (doEmit) { persist(); emit(); }
}

export function toggleCheck(dateISO, habitId) {
  const cur = getRecord(dateISO, habitId);
  setRecord(dateISO, habitId, cur > 0 ? 0 : 1);
}

export function incrementCount(dateISO, habitId, delta) {
  const h = getHabit(habitId);
  const max = h ? Math.max(h.target, 1) : 999;
  const next = Math.max(0, Math.min(max, getRecord(dateISO, habitId) + delta));
  setRecord(dateISO, habitId, next);
}

export function isComplete(habit, dateISO) {
  const v = getRecord(dateISO, habit.id);
  return v >= (habit.type === "count" ? habit.target : 1);
}

export function progressFor(habit, dateISO) {
  const v = getRecord(dateISO, habit.id);
  const target = habit.type === "count" ? habit.target : 1;
  return Math.min(1, v / target);
}

// ---------- Notes / mood ----------
export function getNote(dateISO) { return store.notes[dateISO] || { text: "", mood: null }; }
export function setNote(dateISO, note) {
  if (!note || (!note.text && note.mood == null)) delete store.notes[dateISO];
  else store.notes[dateISO] = { text: note.text || "", mood: note.mood ?? null };
  persist();
  emit();
}

// ---------- Scheduling ----------
export function isScheduled(habit, dateISO) {
  const f = habit.freq || { type: "daily" };
  if (f.type === "daily") return true;
  if (f.type === "weekly") {
    const dow = parseISO(dateISO).getDay();
    return (f.days || []).includes(dow);
  }
  return true;
}

export function scheduledHabits(dateISO) {
  return activeHabits().filter((h) => isScheduled(h, dateISO));
}

export function freqLabel(habit) {
  const f = habit.freq || { type: "daily" };
  if (f.type === "daily") return "Every day";
  const days = f.days || [];
  if (days.length === 7) return "Every day";
  if (days.length === 0) return "No days";
  const wk = [0, 6];
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return "Weekdays";
  if (days.length === 2 && wk.every((d) => days.includes(d))) return "Weekends";
  const L = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days.slice().sort().map((d) => L[d]).join(", ");
}

// ---------- Streaks & stats ----------
export function currentStreak(habit, uptoISO = todayISO()) {
  let streak = 0;
  let date = uptoISO;
  // If today isn't complete yet, start counting from yesterday so an
  // in-progress day doesn't break the visible streak.
  if (isScheduled(habit, date) && !isComplete(habit, date)) {
    date = addDaysISO(date, -1);
  }
  let guard = 0;
  while (guard++ < 3660) {
    if (isScheduled(habit, date)) {
      if (isComplete(habit, date)) streak++;
      else break;
    }
    date = addDaysISO(date, -1);
  }
  return streak;
}

export function bestStreak(habit) {
  const start = habit.createdAt || earliestRecordDate() || todayISO();
  let date = start;
  let best = 0, run = 0, guard = 0;
  const end = todayISO();
  while (date <= end && guard++ < 3660) {
    if (isScheduled(habit, date)) {
      if (isComplete(habit, date)) { run++; best = Math.max(best, run); }
      else run = 0;
    }
    date = addDaysISO(date, 1);
  }
  return best;
}

export function totalCompletions(habit) {
  let total = 0;
  for (const date of Object.keys(store.records)) {
    if (isComplete(habit, date)) total++;
  }
  return total;
}

export function completionRate(habit, fromISO, toISO) {
  let sched = 0, done = 0;
  let date = fromISO;
  let guard = 0;
  while (date <= toISO && guard++ < 4000) {
    if (isScheduled(habit, date)) {
      sched++;
      if (isComplete(habit, date)) done++;
    }
    date = addDaysISO(date, 1);
  }
  return sched ? done / sched : 0;
}

function earliestRecordDate() {
  const dates = Object.keys(store.records).sort();
  return dates[0];
}

// Overall completion for a date across all scheduled habits.
export function dayCompletion(dateISO) {
  const habits = scheduledHabits(dateISO);
  if (!habits.length) return { done: 0, total: 0, ratio: 0 };
  let done = 0;
  for (const h of habits) if (isComplete(h, dateISO)) done++;
  return { done, total: habits.length, ratio: done / habits.length };
}

// Fractional day progress (counts partial count-habit progress).
export function dayProgress(dateISO) {
  const habits = scheduledHabits(dateISO);
  if (!habits.length) return 0;
  let sum = 0;
  for (const h of habits) sum += progressFor(h, dateISO);
  return sum / habits.length;
}

// ---------- Import / Export ----------
export function exportData() {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    habits: store.habits,
    records: store.records,
    notes: store.notes,
  }, null, 2);
}

export function importData(json) {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  if (!data || !Array.isArray(data.habits)) throw new Error("Invalid backup file");
  store.habits = data.habits;
  store.records = data.records || {};
  store.notes = data.notes || {};
  persist();
  emit();
}

export function clearAllData() {
  store.habits = defaultHabits();
  store.records = {};
  store.notes = {};
  persist();
  emit();
}
