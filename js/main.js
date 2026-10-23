// Entry point: load data, wire filters, timeline and ruler.
import { ROLE, ROLES } from "./config.js";
import { save, matches } from "./state.js";
import { initFilters, syncFilters } from "./filters.js";
import { createRuler } from "./ruler.js";
import { createTimeline } from "./timeline.js";
import { $, img } from "./util.js";

async function loadJSON(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

function renderRoles() {
  $("#roles").innerHTML = ROLES.map(r => r === ROLE
    ? `<a href="#" aria-current="page">${img(r.icon, 'alt=""')}${r.label}</a>`
    : `<a aria-disabled="true" title="Coming soon">${img(r.icon, 'alt=""')}${r.label}</a>`).join("");
}

async function boot() {
  renderRoles();
  const tl = $("#tl");
  let cards, scenarios;
  try {
    [cards, scenarios] = await Promise.all([loadJSON(ROLE.data), loadJSON("data/scenarios.json")]);
  } catch (e) {
    console.error(e);
    tl.innerHTML = '<p class="empty">Could not load the card data. If you opened index.html as a file, serve the folder instead (see README).</p>';
    return;
  }

  const ruler = createRuler(tl, scenarios);
  const timeline = createTimeline(tl, scenarios, ruler);

  function update() {
    save();
    syncFilters();
    const shown = cards.filter(matches);
    $("#count").textContent = `${shown.length} / ${cards.length} cards`;
    timeline.render(shown);
  }

  initFilters(update);
  update();
  requestAnimationFrame(() => { ruler.build(); timeline.scrollToToday(); ruler.read(); });
}

boot();
