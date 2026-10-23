// Filter bar: search, chips (card type for support cards, distance + surface
// for Umas), verdict scale.
import { TYPES, DISTANCES, SURFACES, VERDICTS, typeIcon } from "./config.js";
import { state } from "./state.js";
import { $, $$ } from "./util.js";

let onChange = () => {};

/** Build the controls once; `changed` runs after every filter change. */
export function initFilters(changed) {
  onChange = changed;

  chipGroup("#types", TYPES, "types", t => `<img class="ico" src="${typeIcon(t)}" alt="">${t}`);
  chipGroup("#dist", DISTANCES, "dist", d => d);
  chipGroup("#surf", SURFACES, "surf", s => s);

  // Worst → best, left to right. Clicking an icon keeps that verdict and everything better.
  const bar = $("#verdict"), label = $("#vlbl");
  for (const r of [1, 2, 3, 4, 5]) {
    const b = document.createElement("button");
    b.className = "vbtn"; b.dataset.r = r;
    b.title = r === 5 ? VERDICTS[5].label : `${VERDICTS[r].label} or better`;
    b.setAttribute("aria-label", b.title);
    b.innerHTML = `<img src="${VERDICTS[r].icon}" alt="">`;
    b.onclick = () => { state.vmin = state.vmin === r ? 0 : r; onChange(); };
    bar.insertBefore(b, label);
  }

  const q = $("#q");
  q.oninput = () => { state.q = q.value; onChange(); };
}

function chipGroup(sel, values, field, label) {
  const box = $(sel);
  for (const v of values) {
    const b = document.createElement("button");
    b.className = "chip"; b.dataset.v = v;
    b.innerHTML = label(v);
    b.onclick = () => { state[field].has(v) ? state[field].delete(v) : state[field].add(v); onChange(); };
    box.append(b);
  }
}

/** Show the chip groups that apply to this kind of page and reflect the state. */
export function syncFilters(kind) {
  $("#types").hidden = kind !== "support";
  $("#dist").hidden = $("#surf").hidden = kind !== "uma";
  $("#q").value = state.q;
  $("#q").placeholder = kind === "uma" ? "Search an Uma…" : "Search a card…";

  for (const [sel, field] of [["#types", "types"], ["#dist", "dist"], ["#surf", "surf"]])
    $$(`${sel} .chip`).forEach(b => b.setAttribute("aria-pressed", state[field].has(b.dataset.v)));

  $$(".vbtn").forEach(b => {
    const r = +b.dataset.r;
    b.classList.toggle("lit", !!state.vmin && r >= state.vmin);
    b.setAttribute("aria-pressed", r === state.vmin);
  });
  $("#vlbl").textContent = !state.vmin ? "Any verdict"
    : state.vmin === 5 ? VERDICTS[5].label : `${VERDICTS[state.vmin].label} or better`;
}
