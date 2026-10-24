// Static settings shared by every module. Scenario dates and card data live in data/.

// Local date in ISO form, so "Today" follows the visitor's clock.
const now = new Date();
export const TODAY = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");

// ---------- Pages: what (support cards / Umas) × running style ----------

// art: background of the Support cards / Umas switch (focus = which part of the image to show)
export const KINDS = {
  support: { label: "Support cards", noun: "card", art: "assets/cards/30161.webp", focus: "50% 38%" },
  uma:     { label: "Umas",          noun: "Uma",  art: "assets/umas/106520.webp", focus: "50% 36%" },
};

const roleIcon = id => ({ local: `assets/icons/roles/${id}.webp`, remote: `https://uma.guide/img/banner-reviews/badges/playstyle-${id}.webp` });
export const ROLES = [
  { id: "front", label: "Front Runner", icon: roleIcon("front") },
  { id: "pace",  label: "Pace Chaser",  icon: roleIcon("pace") },
  { id: "late",  label: "Late Surger",  icon: roleIcon("late") },
  { id: "end",   label: "End Closer",   icon: roleIcon("end") },
];
export const roleById = id => ROLES.find(r => r.id === id);
export const dataPath = kind => `data/${kind}.json`;

// ---------- Data: one entry per card / Uma, rated per running style ----------
//
// An entry only appears on the running styles listed in its "roles" object,
// e.g. { "pace": {…}, "late": {…} } → shown on Pace Chaser and Late Surger only.
// Each role holds that style's rating; its fields override the shared ones.
export const ROLE_FIELDS = {
  support: ["rank", "verdict", "stats", "skills", "longevity", "bonus"],
  uma:     ["rank", "verdict"],
};

/** The entry as seen on one running style's page, or null if it is not rated there. */
export function forRole(item, role) {
  const r = item.roles?.[role];
  if (!r) return null;
  const { roles, ...base } = item;
  return { ...base, ...r };
}

/** Every entry of this running style's page. */
export const entriesFor = (items, role) => items.map(it => forRole(it, role)).filter(Boolean);

// ---------- Filters ----------

export const TYPES = ["Speed", "Stamina", "Power", "Guts", "Wit", "Pal", "Group"];   // support cards
export const DISTANCES = ["Sprint", "Mile", "Medium", "Long"];                       // Umas
export const SURFACES = ["Turf", "Dirt"];                                             // Umas

// ---------- Verdicts ----------

// rank → label, CSS colour token, icon file
export const VERDICTS = {
  5: { label: "Highly recommended", color: "--v5", icon: "assets/icons/verdicts/highly-recommended.webp" },
  4: { label: "Recommended",        color: "--v4", icon: "assets/icons/verdicts/recommended.webp" },
  3: { label: "Sidegrade",          color: "--v3", icon: "assets/icons/verdicts/sidegrade.webp" },
  2: { label: "Bad",                color: "--v2", icon: "assets/icons/verdicts/bad.webp" },
  1: { label: "Very bad",           color: "--v1", icon: "assets/icons/verdicts/very-bad.webp" },
};

export const rankOf = item => item?.rank ?? null;

// ---------- Links ----------

// Clicking a card's picture or name opens its page on uma.guide (new tab).
// Change these two lines if the site moves its pages.
export const cardLink = card => `https://uma.guide/support-cards/detail?id=${card.id}`;
export const umaLink = uma => `https://uma.guide/characters/${uma.id}`;

// ---------- Images ----------

export const typeIcon = type => `assets/icons/types/${type.toLowerCase()}.svg`;

// Images not committed by hand: local copy first, original URL as fallback.
// scripts/fetch_assets.py downloads them into assets/.
export const SP_ICON = {
  local: "assets/icons/sp.png",
  remote: "https://s3-us-west-2.amazonaws.com/public.notion-static.com/01249879-d648-48a2-b3c8-b368ffff1156/uma_sp_star.png",
};
export const cardImage = card => ({ local: `assets/cards/${card.id}.webp`, remote: card.imgSource });
export const umaImage = uma => ({ local: `assets/umas/${uma.id}.webp`, remote: uma.imgSource });
export const scenarioImage = sc => ({ local: `assets/scenarios/${sc.slug}${extOf(sc.imgSource)}`, remote: sc.imgSource });

function extOf(url) {
  const m = /\.(png|jpe?g|webp|gif)(?:$|[?&])/i.exec(url);
  return m ? "." + m[1].toLowerCase() : ".png";
}
