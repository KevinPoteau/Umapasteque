// Date ruler above the timeline, and the needle "reader" that shows the date
// under it plus the art of the scenario running at that date.
//
// Cards have a fixed width, so dates are mapped piecewise onto the card columns:
// each column's left edge is an anchor (x, date) and the ruler interpolates between them.
import { TODAY, scenarioImage } from "./config.js";
import { $, DAY, ms, fmtDate, img } from "./util.js";
import { isVertical } from "./layout.js";

export function createRuler(tl, scenarios, onScenario = () => {}) {
  const reader = $("#reader"), needle = $("#needle");
  let anchors = []; // [{x, t}], t strictly increasing
  let current = null;
  let lastX = 0;    // left (or top, vertical layout) edge of the last card, in timeline coordinates
  // Horizontal layout: positions are x (offsetLeft); vertical layout: y (offsetTop)
  const at = el => isVertical() ? el.offsetTop : el.offsetLeft;

  // Scenario art, stacked and cross-faded by readRuler()
  const shot = $("#shot");
  shot.insertAdjacentHTML("afterbegin", scenarios.map(s => img(scenarioImage(s), `alt="" data-sc="${s.slug}"`)).join(""));

  const seg = t => { for (let i = 0; i < anchors.length - 1; i++) if (t <= anchors[i + 1].t) return i; return anchors.length - 2; };
  const xOf = t => { const i = seg(t), a = anchors[i], b = anchors[i + 1]; return a.x + (b.x - a.x) * (t - a.t) / (b.t - a.t); };
  const pxPerDay = t => { const i = seg(t), a = anchors[i], b = anchors[i + 1]; return (b.x - a.x) / ((b.t - a.t) / DAY); };
  const tOf = x => {
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      if (x <= b.x) return a.t + (b.t - a.t) * Math.max(0, x - a.x) / (b.x - a.x);
    }
    return anchors.at(-1).t;
  };

  function build() {
    tl.querySelector(".ruler")?.remove();
    const cols = [...tl.querySelectorAll(".col")];
    if (!cols.length) { anchors = []; read(); return; }

    lastX = at(cols.at(-1));
    // Anchors: each card's left edge at its release date, and each scenario
    // section's left edge at the scenario's start date (so the ruler changes
    // scenario exactly where the sections change). Kept only if dates increase.
    const raw = cols.map(c => ({ x: at(c), t: ms(c.dataset.iso) }));
    for (const sec of tl.querySelectorAll(".sc")) {
      const s = scenarios[+sec.id.slice(2)];
      if (s) raw.push({ x: at(sec), t: ms(s.start) });
    }
    raw.sort((a, b) => a.x - b.x || a.t - b.t);
    anchors = [];
    for (const a of raw) if (!anchors.length || a.t > anchors.at(-1).t) anchors.push(a);
    // Cards released the same day share one anchor; when the last cards do,
    // also pin the last card's own edge (1 ms later) so the needle reads its date.
    if (lastX > anchors.at(-1).x) anchors.push({ x: lastX, t: anchors.at(-1).t + 1 });
    // Pad both ends so the ruler runs past the first and last card. The end pad
    // keeps the spacing of the last stretch of cards, so the ruler stops about
    // where the last card ends instead of running months ahead.
    const colW = (isVertical() ? cols.at(-1).offsetHeight : cols.at(-1).offsetWidth) + 24, first = anchors[0], last = anchors.at(-1);
    const prev = [...anchors].reverse().find(a => a.t <= last.t - DAY);
    const endPx = prev ? Math.min(40, Math.max(4, (last.x - prev.x) / ((last.t - prev.t) / DAY))) : 4;
    anchors.unshift({ x: first.x - 90 * 4, t: first.t - 90 * DAY });
    anchors.push({ x: last.x + colW, t: last.t + Math.max(1, Math.round(colW / endPx)) * DAY });

    // Vertical layout: no tick ruler, only the reader bar (date + scenario at the top)
    if (isVertical()) { read(); return; }

    let h = "";
    const end = anchors.at(-1).t;
    for (let d = new Date(anchors[0].t); d.getTime() <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const t = d.getTime(), x = xOf(t);
      if (x < 0) continue;
      const day = d.getUTCDate(), density = pxPerDay(t);
      if (day === 1) {
        const jan = d.getUTCMonth() === 0;
        const label = fmtDate(t, { day: undefined, year: jan ? "numeric" : undefined });
        h += `<div class="tk mo" style="left:${x}px"></div><div class="lb${jan ? " yr" : ""}" style="left:${x}px">${label}</div>`;
      } else if (day % 7 === 1 && density >= 1.2) h += `<div class="tk wk" style="left:${x}px"></div>`;
      else if (density >= 4) h += `<div class="tk" style="left:${x}px"></div>`;
    }
    for (const s of scenarios) {
      const t = ms(s.start);
      if (t >= anchors[0].t && t <= end) h += `<div class="flag" style="left:${xOf(t)}px;--sc:${s.color}"><span>${s.name}</span></div>`;
    }
    h += `<div class="now" style="left:${xOf(ms(TODAY))}px"></div>`;

    const r = document.createElement("div");
    r.className = "ruler"; r.style.width = tl.scrollWidth + "px"; r.innerHTML = h;
    tl.prepend(r);
    read();
  }

  function read() {
    if (isVertical()) return readVertical();
    const nx = reader.offsetWidth;
    if (anchors.length < 2) { needle.style.left = nx + "px"; $("#rdate").textContent = ""; return; }

    // The needle normally sits just right of the reader panel. Near the end of
    // the timeline the last cards cannot scroll that far left, so over the last
    // half-screen of scrolling the needle slides right until it reaches the
    // last card: what it reads stays continuous and the last scenario is reached.
    const max = tl.scrollWidth - tl.clientWidth;
    const overshoot = lastX - max - nx;           // > 0: last card never reaches the needle
    let vx = nx;
    if (overshoot > 0) {
      const span = Math.max(200, tl.clientWidth / 2);
      const p = Math.min(1, Math.max(0, (tl.scrollLeft - (max - span)) / span));
      vx = nx + p * overshoot;
    }
    needle.style.left = vx + "px";

    show(tOf(tl.scrollLeft + vx));
  }

  /** Vertical layout: read the date just under the reader bar; near the bottom, slide down to the last card. */
  function readVertical() {
    if (anchors.length < 2) { $("#rdate").textContent = ""; return; }
    const ny = reader.offsetHeight + 8;
    const max = tl.scrollHeight - tl.clientHeight;
    const overshoot = lastX - max - ny;
    let vy = ny;
    if (overshoot > 0) {
      const span = Math.max(200, tl.clientHeight / 2);
      vy = ny + Math.min(1, Math.max(0, (tl.scrollTop - (max - span)) / span)) * overshoot;
    }
    show(tOf(Math.min(tl.scrollTop + vy, lastX)));   // inside the last card: its date
  }

  /** Date + scenario art of time t. */
  function show(t) {
    const s = [...scenarios].reverse().find(s => t >= ms(s.start)) || scenarios[0];
    $("#rdate").textContent = fmtDate(t);
    if (s !== current) {
      current = s;
      reader.style.setProperty("--sc", s.color);
      $("#rname").textContent = s.name; $("#shotname").textContent = s.name;
      shot.querySelectorAll("img").forEach(i => i.classList.toggle("on", i.dataset.sc === s.slug));
      onScenario(s.slug);
    }
  }

  /** Forget the current scenario so the next read() re-announces it (after a re-render). */
  const refresh = () => { current = null; read(); };

  return { build, read, refresh };
}
