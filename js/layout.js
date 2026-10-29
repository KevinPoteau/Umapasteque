// Horizontal or vertical timeline.
//
//   horizontal: scenarios left to right, cards side by side (large screens)
//   vertical:   scenarios top to bottom, each card full width (small screens)
//
// "Auto" picks vertical when the screen matches VERTICAL_QUERY (js/config.js).
// The Layout button in the filter bar forces one or the other; the choice is
// remembered in this browser.
import { VERTICAL_QUERY } from "./config.js";
import { $ } from "./util.js";

const KEY = "uma-layout";
const CHOICES = ["auto", "horizontal", "vertical"];
const LABELS = { auto: "Layout: auto", horizontal: "Layout: ↔", vertical: "Layout: ↕" };
const media = matchMedia(VERTICAL_QUERY);

function choice() {
  try { const c = localStorage.getItem(KEY); return CHOICES.includes(c) ? c : "auto"; } catch { return "auto"; }
}

export const isVertical = () => document.body.classList.contains("vertical");

/** Set the body class from the choice and the screen; true when it changed. */
function apply() {
  const c = choice();
  const v = c === "vertical" || (c === "auto" && media.matches);
  const changed = v !== isVertical();
  document.body.classList.toggle("vertical", v);
  const b = $("#layout");
  if (b) {
    b.textContent = LABELS[c];
    b.title = c === "auto" ? `Automatic: ${v ? "vertical" : "horizontal"} on this screen (click to change)` : "Click to change the layout";
  }
  return changed;
}

/** Apply now, then call onChange() whenever the layout flips (screen resize or button). */
export function initLayout(onChange) {
  apply();
  media.addEventListener("change", () => { if (apply()) onChange(); });
  $("#layout")?.addEventListener("click", () => {
    const next = CHOICES[(CHOICES.indexOf(choice()) + 1) % CHOICES.length];
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    if (apply()) onChange();
  });
}
