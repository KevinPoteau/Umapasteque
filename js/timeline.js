// Horizontal release timeline: scenario sections, date rail, "Today" marker,
// wheel / keyboard / button scrolling.
import { TODAY } from "./config.js";
import { $, fmtDate } from "./util.js";

export function createTimeline(tl, scenarios, ruler) {
  const prev = $("#prev"), next = $("#next");

  /** cards: filtered items; renderCard(item) → HTML; noun: "card" / "Uma" for the counts */
  function render(cards, renderCard, noun = "card") {
    let html = '<div class="spacer"></div>', todayDone = false;
    let jump = '<option value="">Jump to…</option><option value="today">Today</option>';

    scenarios.forEach((s, i) => {
      const cs = cards.filter(c => c.scenario === s.name).sort((a, b) => a.iso.localeCompare(b.iso));
      if (!cs.length) return;
      jump += `<option value="sc${i}">${s.name}</option>`;
      let cols = "";
      for (const c of cs) {
        if (!todayDone && c.iso >= TODAY) { cols += '<div class="today" id="today"><b>Today</b></div>'; todayDone = true; }
        cols += `<div class="col" data-iso="${c.iso}"><div class="when${c.iso < TODAY ? " past" : ""}"><i></i><span>${c.date}</span></div>${renderCard(c)}</div>`;
      }
      const since = s.live ? `live since ${fmtDate(s.start)}` : `est. ${fmtDate(s.start)}`;
      html += `<section class="sc" id="sc${i}" style="--sc:${s.color}">
        <div class="sc-head"><h2>${s.name}</h2><small>${since} · ${cs.length} ${noun}${cs.length > 1 ? "s" : ""}</small></div>
        <div class="cards">${cols}</div></section>`;
    });
    if (!todayDone) html += '<div class="today" id="today"><b>Today</b></div>';

    tl.innerHTML = cards.length ? html + '<div class="spacer"></div>' : `<p class="empty">No ${noun} matches these filters.</p>`;
    $("#jump").innerHTML = jump;
    watchSizes();
    navState();
    ruler.build();
  }

  function scrollToEl(el, smooth) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    tl.scrollTo({ left: Math.max(0, el.offsetLeft - $("#reader").offsetWidth - 12), behavior: smooth && !reduce ? "smooth" : "auto" });
  }

  /** Open on "Today", keeping the latest released card in view. */
  function scrollToToday() {
    const t = document.getElementById("today");
    const before = t?.previousElementSibling;
    scrollToEl(before?.classList.contains("col") ? before : (t || tl), false);
  }

  function navState() {
    prev.disabled = tl.scrollLeft < 4;
    next.disabled = tl.scrollLeft > tl.scrollWidth - tl.clientWidth - 4;
  }

  // Vertical wheel scrolls the timeline sideways (Firefox reports lines/pages, not pixels)
  $(".tl-wrap").addEventListener("wheel", e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.ctrlKey) return;
    const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? tl.clientWidth : 1;
    tl.scrollLeft += e.deltaY * k;
    e.preventDefault();
  }, { passive: false });

  const step = () => Math.max(300, tl.clientWidth * 0.8);
  prev.onclick = () => tl.scrollBy({ left: -step(), behavior: "smooth" });
  next.onclick = () => tl.scrollBy({ left: step(), behavior: "smooth" });
  tl.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { e.preventDefault(); next.click(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); prev.click(); }
  });
  tl.addEventListener("scroll", () => { navState(); ruler.read(); }, { passive: true });
  addEventListener("resize", () => { navState(); ruler.build(); });

  $("#jump").onchange = e => {
    const el = document.getElementById(e.target.value);
    if (el) scrollToEl(el, true);
    e.target.value = "";
  };

  // Rebuild the ruler when sections change size after render (images, fonts)
  let timer = 0;
  const ro = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(ruler.build, 120); });
  function watchSizes() { ro.disconnect(); tl.querySelectorAll(".sc").forEach(s => ro.observe(s)); }

  return { render, scrollToToday };
}
