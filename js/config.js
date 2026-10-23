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
export const dataPath = (kind, role) => `data/${kind}/${role}.json`;

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

// Entries whose Notion verdict used a custom emoji keep its id in "verdictKey".
// Map those ids to a rank here (5 … 1); unmapped ones show as "Unrated".
export const CUSTOM_VERDICTS = {
  "8168": 5,   // Highly recommended — e.g. Narita Taishin Wit, Still in Love SPD
  "8161": 4,   // Recommended        — e.g. Hishi Amazon PWR, Duramente SPD, Satono Diamond Wit (Late)
  "81e5": 2,   // Bad                — e.g. Vivlos Guts
  "81fc": 3,   // Sidegrade          — e.g. Daitaku Helios (Uma), Vivlos SPD, Zenno Rob Roy (Uma)
};

export const rankOf = item => item.rank ?? CUSTOM_VERDICTS[item.verdictKey] ?? null;

// ---------- Images ----------

export const typeIcon = type => `assets/icons/types/${type.toLowerCase()}.svg`;

// Images not committed by hand: local copy first, original URL as fallback.
// scripts/fetch_assets.py downloads them into assets/.
export const SP_ICON = {
  local: "assets/icons/sp.png",
  remote: "https://s3-us-west-2.amazonaws.com/public.notion-static.com/01249879-d648-48a2-b3c8-b368ffff1156/uma_sp_star.png",
};
// Race shoes from the game, one per distance and surface (Turf is a recoloured
// Dirt shoe, the game has none). Used by the filters and the aptitude tags.
export const shoeIcon = name => `assets/icons/shoes/${name.toLowerCase()}.png`;
// Aptitude tag prefix → shoe ("Med A" → medium)
export const APTITUDE_SHOE = { Sprint: "sprint", Mile: "mile", Med: "medium", Medium: "medium", Long: "long", Turf: "turf", Dirt: "dirt" };
export const cardImage = card => ({ local: `assets/cards/${card.id}.webp`, remote: card.imgSource });
export const umaImage = uma => ({ local: `assets/umas/${uma.id}.webp`, remote: uma.imgSource });
export const scenarioImage = sc => ({ local: `assets/scenarios/${sc.slug}${extOf(sc.imgSource)}`, remote: sc.imgSource });

function extOf(url) {
  const m = /\.(png|jpe?g|webp|gif)(?:$|[?&])/i.exec(url);
  return m ? "." + m[1].toLowerCase() : ".png";
}
