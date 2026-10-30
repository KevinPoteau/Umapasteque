// Horizontal or vertical timeline.
//
//   horizontal: scenarios left to right, cards side by side (large screens)
//   vertical:   scenarios top to bottom, each card full width (small screens)
//
// Vertical when the screen matches VERTICAL_QUERY (js/config.js).
import { VERTICAL_QUERY } from "./config.js";

const media = matchMedia(VERTICAL_QUERY);

export const isVertical = () => document.body.classList.contains("vertical");

/** Set the body class from the screen; true when it changed. */
function apply() {
  const changed = media.matches !== isVertical();
  document.body.classList.toggle("vertical", media.matches);
  return changed;
}

/** Apply now, then call onChange() whenever the layout flips (window resized, phone turned). */
export function initLayout(onChange) {
  apply();
  media.addEventListener("change", () => { if (apply()) onChange(); });
}
