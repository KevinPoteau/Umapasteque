// Horizontal release timeline: scenario sections, date rail, "Today" marker,
// wheel / keyboard / button scrolling.
import { TODAY, scenarioImage } from "./config.js";
import { $, $$, fmtDate, img } from "./util.js";

export function createTimeline(tl, scenarios, ruler) {
  const prev = $("#prev"), next = $("#next");

  /** cards: filtered items; renderCard(item) → HTML; noun: "card" / "Uma" for the counts */
  function render(cards, renderCard, noun = "card") {
    let html = '<div class="spacer"></div>', todayDone = false;
    let jump = '<button class="jb today-btn" data-to="today">Today</button>';

    scenarios.forEach((s, i) => {
      const cs = cards.filter(c => c.scenario === s.name).sort((a, b) => a.iso.localeCompare(b.iso));
      if (!cs.length) return;
      jump += `<button class="jb" data-to="sc${i}" data-sc="${s.slug}" style="--sc:${s.color}" title="${s.name}">${img(scenarioImage(s), 'alt=""')}<span>${s.name}</span></button>`;
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
    fitCards();
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
  addEventListener("resize", () => { fitCards(); navState(); ruler.build(); });
  document.fonts?.ready.then(() => { fitCards(); ruler.build(); });

  /**
   * Cards never scroll inside: a card whose text is taller than the screen
   * allows is made wider instead (its right column flows into more columns),
   * step by step until everything fits.
   */
  function fitCards() {
    const STEP = 70, MAX = 3; // grow by 70 px, up to 3× the normal width
    const tooTall = card => card.scrollHeight > card.clientHeight + 1;

    for (const col of tl.querySelectorAll(".col")) {
      const card = col.querySelector(".card");
      col.style.removeProperty("--w");
      card.classList.remove("flow");
      const base = col.offsetWidth;

      const widen = () => {
        let w = base;
        while (tooTall(card) && w < base * MAX) {
          w += STEP;
          col.style.setProperty("--w", `${w}px`);
        }
      };
      widen();
      // Still too tall (small screen): let the image and ratings flow into
      // the columns too, then widen again from the normal width.
      if (tooTall(card)) {
        card.classList.add("flow");
        col.style.removeProperty("--w");
        widen();
      }
    }
  }

  // Scenario buttons: jump to the start of that scenario (or to Today)
  $("#jump").addEventListener("click", e => {
    const b = e.target.closest(".jb");
    const el = b && document.getElementById(b.dataset.to);
    if (el) scrollToEl(el, true);
  });

  // Rebuild the ruler when sections change size after render (images, fonts)
  let timer = 0;
  const ro = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(ruler.build, 120); });
  function watchSizes() { ro.disconnect(); tl.querySelectorAll(".sc").forEach(s => ro.observe(s)); }

  /** Highlight the button of the scenario under the needle (called by the ruler). */
  function markScenario(slug) {
    $$("#jump .jb[data-sc]").forEach(b => b.toggleAttribute("aria-current", b.dataset.sc === slug));
  }

  return { render, scrollToToday, markScenario };
}
