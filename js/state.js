// Filter state, one set per kind of page (support cards / Umas),
// remembered per browser (best effort: storage can be blocked).
import { rankOf } from "./config.js";

const blank = () => ({ q: "", types: new Set(), dist: new Set(), surf: new Set(), vmin: 0 });
const SETS = ["types", "dist", "surf"];

export let state = blank();
let key = "";

/** Switch to the filters of another kind of page. */
export function useStateFor(kind) {
  key = `uma-filters-${kind}`;
  state = blank();
  try {
    const s = JSON.parse(localStorage.getItem(key) || "null");
    if (s) {
      state.q = s.q || "";
      state.vmin = +s.vmin || 0;
      for (const k of SETS) state[k] = new Set(s[k] || []);
    }
  } catch { /* ignore */ }
  return state;
}

export function save() {
  const plain = { q: state.q, vmin: state.vmin };
  for (const k of SETS) plain[k] = [...state[k]];
  try { localStorage.setItem(key, JSON.stringify(plain)); } catch { /* ignore */ }
}

export function reset() {
  state.q = ""; state.vmin = 0;
  for (const k of SETS) state[k].clear();
}

const DIST_CODE = { Sprint: "Sprint", Mile: "Mile", Medium: "Med", Long: "Long" };
const hasAptitude = (uma, word) => uma.aptitudes?.some(a => a.split(" ")[0] === word);

export function matches(item) {
  const q = state.q.trim().toLowerCase();
  const text = `${item.name} ${item.outfit || ""}`.toLowerCase();
  return (!q || text.includes(q))
    && (!state.types.size || state.types.has(item.type))
    && (!state.dist.size || [...state.dist].some(d => hasAptitude(item, DIST_CODE[d])))
    && (!state.surf.size || [...state.surf].some(s => hasAptitude(item, s)))
    && (!state.vmin || (rankOf(item) || 0) >= state.vmin);
}
