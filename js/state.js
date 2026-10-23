// Filter state, remembered per browser (best effort: storage can be blocked).
const KEY = "uma-end-filters";

export const state = { q: "", types: new Set(), vmin: 0 };

try {
  const s = JSON.parse(localStorage.getItem(KEY) || "null");
  if (s) { state.q = s.q || ""; state.types = new Set(s.types || []); state.vmin = +s.vmin || 0; }
} catch { /* ignore */ }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...state, types: [...state.types] })); } catch { /* ignore */ }
}

export function reset() {
  state.q = ""; state.types.clear(); state.vmin = 0;
}

export function matches(card) {
  const q = state.q.trim().toLowerCase();
  return (!q || card.name.toLowerCase().includes(q))
    && (!state.types.size || state.types.has(card.type))
    && (!state.vmin || (card.rank || 0) >= state.vmin);
}
