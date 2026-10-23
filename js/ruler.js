// Date ruler above the timeline, and the needle "reader" that shows the date
// under it plus the art of the scenario running at that date.
//
// Cards have a fixed width, so dates are mapped piecewise onto the card columns:
// each column's left edge is an anchor (x, date) and the ruler interpolates between them.
import { TODAY, scenarioImage } from "./config.js";
import { $, DAY, ms, fmtDate, img } from "./util.js";

export function createRuler(tl, scenarios, onScenario = () => {}) {
  const reader = $("#reader"), needle = $("#needle");
  let anchors = []; // [{x, t}], t strictly increasing
  let current = null;

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

    anchors = [];
    for (const c of cols) {
      const a = { x: c.offsetLeft, t: ms(c.dataset.iso) };
      if (!anchors.length || a.t > anchors.at(-1).t) anchors.push(a);
    }
    // Pad both ends at 4 px/day so the ruler runs past the first and last card
    const pxDay = 4, colW = cols[0].offsetWidth + 24, first = anchors[0], last = anchors.at(-1);
    anchors.unshift({ x: first.x - 90 * pxDay, t: first.t - 90 * DAY });
    anchors.push({ x: last.x + colW, t: last.t + Math.round(colW / pxDay) * DAY });

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
    const nx = reader.offsetWidth;
    needle.style.left = nx + "px";
    if (anchors.length < 2) { $("#rdate").textContent = ""; return; }
    const t = tOf(tl.scrollLeft + nx);
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
