// Filter bar: search, card type chips, verdict scale, reset.
import { TYPES, VERDICTS, typeIcon } from "./config.js";
import { state, reset } from "./state.js";
import { $, $$ } from "./util.js";

export function initFilters(onChange) {
  const types = $("#types");
  for (const t of TYPES) {
    const b = document.createElement("button");
    b.className = "chip"; b.dataset.t = t;
    b.innerHTML = `<img class="ico" src="${typeIcon(t)}" alt="">${t}`;
    b.onclick = () => { state.types.has(t) ? state.types.delete(t) : state.types.add(t); onChange(); };
    types.append(b);
  }

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
  q.value = state.q;
  q.oninput = () => { state.q = q.value; onChange(); };
  $("#reset").onclick = () => { reset(); q.value = ""; onChange(); };
}

export function syncFilters() {
  $$("#types .chip").forEach(b => b.setAttribute("aria-pressed", state.types.has(b.dataset.t)));
  $$(".vbtn").forEach(b => {
    const r = +b.dataset.r;
    b.classList.toggle("lit", !!state.vmin && r >= state.vmin);
    b.setAttribute("aria-pressed", r === state.vmin);
  });
  $("#vlbl").textContent = !state.vmin ? "Any verdict"
    : state.vmin === 5 ? VERDICTS[5].label : `${VERDICTS[state.vmin].label} or better`;
}
