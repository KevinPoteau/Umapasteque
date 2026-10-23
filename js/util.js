export const $ = sel => document.querySelector(sel);
export const $$ = sel => [...document.querySelectorAll(sel)];

export const DAY = 864e5;
export const ms = iso => Date.parse(iso + "T00:00Z");
export const fmtDate = (t, opts = {}) =>
  new Date(typeof t === "string" ? ms(t) : t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC", ...opts });

/** <img> that tries the copy stored in the repo first, then the original site. */
export const img = ({ local, remote }, attrs = "") =>
  `<img src="${local}" data-remote="${remote ?? ""}" ${attrs}>`;

// One capturing listener handles every image error on the page:
// local copy missing → original URL → placeholder (or nothing).
document.addEventListener("error", e => {
  const el = e.target;
  if (!(el instanceof HTMLImageElement)) return;
  const remote = el.dataset.remote;
  if (remote && el.src !== remote) { el.dataset.remote = ""; el.src = remote; return; }
  if (el.dataset.placeholder !== undefined) {
    const ph = document.createElement("div");
    ph.className = "ph"; ph.textContent = el.alt;
    el.replaceWith(ph);
  } else el.remove();
}, true);
