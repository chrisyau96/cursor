// Lightweight dependency-free charts built with inline SVG / DOM.
import { el } from "./utils.js";

const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// Circular progress ring. ratio 0..1
export function progressRing(ratio, { size = 74, stroke = 8, label } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * Math.max(0, Math.min(1, ratio));
  const wrap = el("div", { class: "ring" });
  const svg = svgEl("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}` });
  const track = svgEl("circle", {
    cx: size / 2, cy: size / 2, r,
    fill: "none", stroke: "rgba(255,255,255,.22)", "stroke-width": stroke,
  });
  const prog = svgEl("circle", {
    cx: size / 2, cy: size / 2, r,
    fill: "none", stroke: "#fff", "stroke-width": stroke,
    "stroke-linecap": "round",
    "stroke-dasharray": `${dash} ${c}`,
  });
  svg.appendChild(track);
  svg.appendChild(prog);
  wrap.appendChild(svg);
  wrap.appendChild(el("div", { class: "ring-label", text: label ?? `${Math.round(ratio * 100)}%` }));
  return wrap;
}

// Vertical bar chart. data: [{label, value, sub}], valueMax optional, color optional
export function barChart(data, { max, color, unit = "" } = {}) {
  const peak = max ?? Math.max(1, ...data.map((d) => d.value));
  const wrap = el("div", { class: "bars" });
  for (const d of data) {
    const h = peak ? Math.round((d.value / peak) * 100) : 0;
    const zero = d.value <= 0;
    const bwrap = el("div", { class: "bwrap" });
    const bar = el("div", { class: "b" + (zero ? " zero" : "") });
    if (color && !zero) bar.style.background = color;
    bar.style.height = `${Math.max(h, zero ? 4 : 6)}%`;
    bwrap.appendChild(bar);
    const col = el("div", { class: "barcol" }, [
      el("div", { class: "bval", text: d.showVal != null ? d.showVal : (d.value ? `${d.value}${unit}` : "") }),
      bwrap,
      el("div", { class: "blabel", text: d.label }),
    ]);
    wrap.appendChild(col);
  }
  return wrap;
}

// Line chart of percentages (0..1). points: [{label, value}]
export function lineChart(points, { color = "#4f46e5" } = {}) {
  const W = 320, H = 150, padL = 4, padR = 4, padT = 12, padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = points.length;
  const x = (i) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => padT + innerH - v * innerH;

  const svg = svgEl("svg", { class: "linechart", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none" });
  const defs = svgEl("defs");
  const grad = svgEl("linearGradient", { id: "areaGrad", x1: "0", y1: "0", x2: "0", y2: "1" });
  grad.appendChild(svgEl("stop", { offset: "0%", "stop-color": color, "stop-opacity": "0.28" }));
  grad.appendChild(svgEl("stop", { offset: "100%", "stop-color": color, "stop-opacity": "0" }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  // gridlines at 0/50/100%
  [0, 0.5, 1].forEach((g) => {
    svg.appendChild(svgEl("line", { class: "grid-line", x1: padL, x2: W - padR, y1: y(g), y2: y(g) }));
  });

  if (n > 0) {
    const linePts = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
    const areaD = `M ${x(0)},${y(0)} L ${points.map((p, i) => `${x(i)},${y(p.value)}`).join(" L ")} L ${x(n - 1)},${y(0)} Z`;
    const area = svgEl("path", { class: "area", d: areaD });
    area.setAttribute("fill", "url(#areaGrad)");
    svg.appendChild(area);
    const line = svgEl("polyline", { class: "line", points: linePts });
    line.setAttribute("stroke", color);
    svg.appendChild(line);
    points.forEach((p, i) => {
      const dot = svgEl("circle", { class: "dot", cx: x(i), cy: y(p.value), r: 3 });
      dot.setAttribute("stroke", color);
      svg.appendChild(dot);
    });
  }

  // x labels (show a subset to avoid clutter)
  const step = Math.ceil(n / 6);
  points.forEach((p, i) => {
    if (i % step !== 0 && i !== n - 1) return;
    const t = svgEl("text", { class: "axis-label", x: x(i), y: H - 6, "text-anchor": "middle" });
    t.textContent = p.label;
    svg.appendChild(t);
  });
  return svg;
}

// Heat color scale for a ratio 0..1 using the brand hue.
export function heatColor(ratio) {
  if (ratio <= 0) return "";
  // 4 buckets
  const levels = ["#c7d2fe", "#a5b4fc", "#818cf8", "#4f46e5"];
  const idx = ratio >= 1 ? 3 : ratio >= 0.66 ? 2 : ratio >= 0.33 ? 1 : 0;
  return levels[idx];
}

// GitHub-style yearly heatmap. dayMap: Map(dateISO -> ratio). weeks columns.
export function yearHeat(startISO, endISO, ratioForDate) {
  const scroll = el("div", { class: "year-heat-scroll" });
  const grid = el("div", { class: "year-heat" });
  const start = new Date(startISO + "T00:00:00");
  // align to Sunday
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(endISO + "T00:00:00");
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    const dateISO = `${y}-${m}-${d}`;
    const ratio = ratioForDate(dateISO);
    const cell = el("div", { class: "hc", title: `${dateISO} · ${Math.round(ratio * 100)}%` });
    const col = heatColor(ratio);
    if (col) cell.style.background = col;
    if (dateISO > endISO) cell.style.visibility = "hidden";
    grid.appendChild(cell);
    cur.setDate(cur.getDate() + 1);
  }
  scroll.appendChild(grid);
  return scroll;
}

export function heatLegend() {
  const wrap = el("div", { class: "heat-legend" }, [el("span", { text: "Less" })]);
  ["", "#c7d2fe", "#a5b4fc", "#818cf8", "#4f46e5"].forEach((c) => {
    const box = el("span", { class: "box" });
    if (c) box.style.background = c;
    wrap.appendChild(box);
  });
  wrap.appendChild(el("span", { text: "More" }));
  return wrap;
}
