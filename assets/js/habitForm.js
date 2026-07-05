// Create / edit habit sheet, and delete confirmation.
import { el, $, $$, dowLetter } from "./utils.js";
import { EMOJIS, PALETTE, addHabit, updateHabit, deleteHabit, freqLabel } from "./store.js";

export function habitFormSheet(openSheet, closeSheet, toast, existing = null) {
  const isEdit = !!existing;
  const state = {
    name: existing?.name || "",
    icon: existing?.icon || "✅",
    color: existing?.color || PALETTE[0],
    type: existing?.type || "check",
    target: existing?.target || 1,
    unit: existing?.unit || "cups",
    category: existing?.category || "Routine",
    freqType: existing?.freq?.type || "daily",
    days: (existing?.freq?.days || [0, 1, 2, 3, 4, 5, 6]).slice(),
  };

  const content = el("div");

  content.appendChild(el("h3", { text: isEdit ? "Edit habit" : "New habit" }));
  content.appendChild(el("div", { class: "sheet-sub", text: isEdit ? "Update the details of this habit." : "Design a small, repeatable action." }));

  // Name
  const nameInput = el("input", { type: "text", placeholder: "e.g. Read 10 pages", value: state.name, maxlength: "40" });
  content.appendChild(field("Habit name", nameInput));

  // Emoji picker
  const emojiRow = el("div", { class: "picker-row" });
  EMOJIS.forEach((e) => {
    const b = el("button", { type: "button", class: "picker-emoji" + (e === state.icon ? " sel" : ""), text: e });
    b.addEventListener("click", () => {
      state.icon = e;
      $$(".picker-emoji", emojiRow).forEach((n) => n.classList.remove("sel"));
      b.classList.add("sel");
    });
    emojiRow.appendChild(b);
  });
  content.appendChild(field("Icon", emojiRow));

  // Color picker
  const colorRow = el("div", { class: "picker-row" });
  PALETTE.forEach((c) => {
    const b = el("button", { type: "button", class: "picker-color" + (c === state.color ? " sel" : "") });
    b.style.background = c;
    b.addEventListener("click", () => {
      state.color = c;
      $$(".picker-color", colorRow).forEach((n) => n.classList.remove("sel"));
      b.classList.add("sel");
    });
    colorRow.appendChild(b);
  });
  content.appendChild(field("Color", colorRow));

  // Type toggle (check vs count)
  const countOpts = el("div", { class: state.type === "count" ? "" : "hidden" });
  const targetInput = el("input", { type: "number", min: "1", max: "99", value: String(state.target) });
  const unitInput = el("input", { type: "text", placeholder: "cups, min, pages…", value: state.unit, maxlength: "12" });
  countOpts.appendChild(el("div", { class: "picker-row", style: "gap:10px" }, [
    el("div", { style: "flex:1" }, [el("label", { class: "tiny", text: "Daily goal", style: "display:block;margin-bottom:6px" }), targetInput]),
    el("div", { style: "flex:1" }, [el("label", { class: "tiny", text: "Unit", style: "display:block;margin-bottom:6px" }), unitInput]),
  ]));

  const typeWrap = el("div", { class: "type-toggle" });
  const checkBtn = el("button", { type: "button", class: "" }, [
    el("span", { class: "tt-title", text: "✔ Yes / No" }), document.createTextNode("Simple done"),
  ]);
  const countBtn = el("button", { type: "button", class: "" }, [
    el("span", { class: "tt-title", text: "# Measurable" }), document.createTextNode("Count a goal"),
  ]);
  function refreshType() {
    checkBtn.classList.toggle("sel", state.type === "check");
    countBtn.classList.toggle("sel", state.type === "count");
    countOpts.classList.toggle("hidden", state.type !== "count");
  }
  checkBtn.addEventListener("click", () => { state.type = "check"; refreshType(); });
  countBtn.addEventListener("click", () => { state.type = "count"; refreshType(); });
  typeWrap.appendChild(checkBtn);
  typeWrap.appendChild(countBtn);
  refreshType();
  content.appendChild(field("Type", el("div", {}, [typeWrap, el("div", { class: "spacer-sm" }), countOpts])));

  // Frequency
  const freqSeg = el("div", { class: "segmented", style: "margin:0 0 10px" });
  const everyBtn = el("button", { type: "button", text: "Every day" });
  const specBtn = el("button", { type: "button", text: "Specific days" });
  const dayPicker = el("div", { class: "weekday-picker" });
  for (let i = 0; i < 7; i++) {
    const b = el("button", { type: "button", text: dowLetter(i), dataset: { d: String(i) } });
    if (state.days.includes(i)) b.classList.add("sel");
    b.addEventListener("click", () => {
      const d = i;
      if (state.days.includes(d)) state.days = state.days.filter((x) => x !== d);
      else state.days.push(d);
      b.classList.toggle("sel");
    });
    dayPicker.appendChild(b);
  }
  function refreshFreq() {
    everyBtn.classList.toggle("active", state.freqType === "daily");
    specBtn.classList.toggle("active", state.freqType === "weekly");
    dayPicker.classList.toggle("hidden", state.freqType !== "weekly");
  }
  everyBtn.addEventListener("click", () => { state.freqType = "daily"; refreshFreq(); });
  specBtn.addEventListener("click", () => { state.freqType = "weekly"; refreshFreq(); });
  freqSeg.appendChild(everyBtn);
  freqSeg.appendChild(specBtn);
  refreshFreq();
  content.appendChild(field("Frequency", el("div", {}, [freqSeg, dayPicker])));

  // Category
  const catInput = el("input", { type: "text", placeholder: "Morning, Health, Focus…", value: state.category, maxlength: "20" });
  content.appendChild(field("Category", catInput));

  // Actions
  const saveBtn = el("button", { class: "btn btn-primary", text: isEdit ? "Save changes" : "Create habit" });
  saveBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) { toast("Please enter a name"); nameInput.focus(); return; }
    let days = state.days.slice().sort();
    if (state.freqType === "weekly" && days.length === 0) { toast("Pick at least one day"); return; }
    const payload = {
      name,
      icon: state.icon,
      color: state.color,
      type: state.type,
      target: Number(targetInput.value) || 1,
      unit: unitInput.value.trim(),
      category: catInput.value.trim() || "Routine",
      freq: state.freqType === "daily"
        ? { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }
        : { type: "weekly", days },
    };
    if (isEdit) { updateHabit(existing.id, payload); toast("Habit updated"); }
    else { addHabit(payload); toast("Habit created"); }
    closeSheet();
  });

  const actions = el("div", { class: "sheet-actions" });
  if (isEdit) {
    const delBtn = el("button", { class: "btn btn-danger", text: "Delete" });
    delBtn.addEventListener("click", () => {
      confirmDelete(openSheet, closeSheet, toast, existing);
    });
    actions.appendChild(delBtn);
  }
  actions.appendChild(saveBtn);
  content.appendChild(actions);

  openSheet(content);
  setTimeout(() => nameInput.focus(), 120);
}

function confirmDelete(openSheet, closeSheet, toast, habit) {
  const content = el("div");
  content.appendChild(el("h3", { text: "Delete habit?" }));
  content.appendChild(el("div", { class: "sheet-sub", text: `“${habit.name}” and all its records will be removed. This cannot be undone.` }));
  const actions = el("div", { class: "sheet-actions" });
  const cancel = el("button", { class: "btn btn-soft", text: "Cancel" });
  cancel.addEventListener("click", closeSheet);
  const del = el("button", { class: "btn btn-danger", text: "Delete" });
  del.addEventListener("click", () => { deleteHabit(habit.id); toast("Habit deleted"); closeSheet(); });
  actions.appendChild(cancel);
  actions.appendChild(del);
  content.appendChild(actions);
  openSheet(content);
}

function field(labelText, control) {
  return el("div", { class: "field" }, [el("label", { text: labelText }), control]);
}
