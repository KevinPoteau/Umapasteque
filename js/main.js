// Entry point: routing between pages, data loading, wiring filters, timeline and ruler.
//
// A page is "<kind>/<role>", e.g. #support/end or #uma/front, kept in the URL hash
// so every page can be bookmarked and shared.
import { KINDS, ROLES, dataPath } from "./config.js";
import { useStateFor, save, matches } from "./state.js";
import { initFilters, syncFilters } from "./filters.js";
import { createRuler } from "./ruler.js";
import { createTimeline } from "./timeline.js";
import { supportCardHTML, umaCardHTML } from "./card.js";
import { $, img } from "./util.js";

const DEFAULT_PAGE = { kind: "support", role: "end" };
const LAST_PAGE_KEY = "uma-last-page";

let page = null;     // { kind, role }
let items = [];      // everything on the current page
let timeline, ruler; // created once scenarios are loaded
const cache = {};    // data path → parsed JSON

async function loadJSON(path) {
  if (!cache[path]) {
    const r = await fetch(path, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    cache[path] = await r.json();
  }
  return cache[path];
}

/** "#uma/late" → { kind: "uma", role: "late" }; anything unknown → null */
function parseHash(hash) {
  const [kind, role] = hash.replace(/^#/, "").split("/");
  return KINDS[kind] && ROLES.some(r => r.id === role) ? { kind, role } : null;
}

function renderNav() {
  $("#kinds").innerHTML = Object.entries(KINDS).map(([k, v]) =>
    `<a href="#${k}/${page.role}"${k === page.kind ? ' aria-current="page"' : ""}>` +
    `<img src="${v.art}" alt="" style="object-position:${v.focus}"><span>${v.label}</span></a>`).join("");
  $("#roles").innerHTML = ROLES.map(r =>
    `<a href="#${page.kind}/${r.id}"${r.id === page.role ? ' aria-current="page"' : ""}>${img(r.icon, 'alt=""')}${r.label}</a>`).join("");
  const role = ROLES.find(r => r.id === page.role);
  document.title = `Umapastèque · ${KINDS[page.kind].label} · ${role.label}`;
}

/** Re-filter and re-render the current page. */
function update() {
  save();
  syncFilters(page.kind);
  const shown = items.filter(matches);
  const noun = KINDS[page.kind].noun;
  $("#count").textContent = `${shown.length} / ${items.length} ${noun}s`;
  const render = page.kind === "uma" ? u => umaCardHTML(u, page.role) : supportCardHTML;
  timeline.render(shown, render, noun);
  ruler.refresh();
}

async function openPage(next) {
  page = next;
  try { localStorage.setItem(LAST_PAGE_KEY, `${page.kind}/${page.role}`); } catch { /* ignore */ }
  renderNav();
  useStateFor(page.kind);
  try {
    items = await loadJSON(dataPath(page.kind, page.role));
  } catch (e) {
    console.error(e);
    $("#tl").innerHTML = '<p class="empty">Could not load this page\'s data.</p>';
    return;
  }
  if (page !== next) return; // another page was opened while loading
  update();
  requestAnimationFrame(() => { ruler.build(); timeline.scrollToToday(); ruler.read(); });
}

function route() {
  const target = parseHash(location.hash);
  if (!target) {
    let last = null;
    try { last = parseHash("#" + (localStorage.getItem(LAST_PAGE_KEY) || "")); } catch { /* ignore */ }
    const p = last || DEFAULT_PAGE;
    history.replaceState(null, "", `#${p.kind}/${p.role}`);
    return openPage(p);
  }
  return openPage(target);
}

async function boot() {
  const tl = $("#tl");
  let scenarios;
  try {
    scenarios = await loadJSON("data/scenarios.json");
  } catch (e) {
    console.error(e);
    tl.innerHTML = '<p class="empty">Could not load the data. If you opened index.html as a file, serve the folder instead (see README).</p>';
    return;
  }
  ruler = createRuler(tl, scenarios, slug => timeline?.markScenario(slug));
  timeline = createTimeline(tl, scenarios, ruler);
  initFilters(update);
  addEventListener("hashchange", route);
  route();
}

boot();
