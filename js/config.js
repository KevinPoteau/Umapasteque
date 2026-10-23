// Static settings shared by every module. Scenario dates and card data live in data/.

// Local date in ISO form, so "Today" follows the visitor's clock.
const now = new Date();
export const TODAY = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");

const ROLE_ICON = id => ({ local: `assets/icons/roles/${id}.webp`, remote: `https://uma.guide/img/banner-reviews/badges/playstyle-${id}.webp` });
export const ROLES = [
  { id: "front", label: "Front Runner", icon: ROLE_ICON("front") },
  { id: "pace",  label: "Pace Chaser",  icon: ROLE_ICON("pace") },
  { id: "late",  label: "Late Surger",  icon: ROLE_ICON("late") },
  { id: "end",   label: "End Closer",   icon: ROLE_ICON("end"), data: "data/support/end.json" },
];
export const ROLE = ROLES.find(r => r.id === "end");

export const TYPES = ["Speed", "Stamina", "Power", "Guts", "Wit", "Pal", "Group"];

// rank → label, CSS colour token, icon file
export const VERDICTS = {
  5: { label: "Highly recommended", color: "--v5", icon: "assets/icons/verdicts/highly-recommended.webp" },
  4: { label: "Recommended",        color: "--v4", icon: "assets/icons/verdicts/recommended.webp" },
  3: { label: "Sidegrade",          color: "--v3", icon: "assets/icons/verdicts/sidegrade.webp" },
  2: { label: "Bad",                color: "--v2", icon: "assets/icons/verdicts/bad.webp" },
  1: { label: "Very bad",           color: "--v1", icon: "assets/icons/verdicts/very-bad.webp" },
};

export const typeIcon = type => `assets/icons/types/${type.toLowerCase()}.svg`;

// Images we do not have in the repo yet: local path first, original URL as fallback.
// scripts/fetch_assets.py downloads them into assets/.
export const SP_ICON = {
  local: "assets/icons/sp.png",
  remote: "https://s3-us-west-2.amazonaws.com/public.notion-static.com/01249879-d648-48a2-b3c8-b368ffff1156/uma_sp_star.png",
};
export const cardImage = card => ({ local: `assets/cards/${card.id}.webp`, remote: card.imgSource });
export const scenarioImage = sc => ({ local: `assets/scenarios/${sc.slug}${extOf(sc.imgSource)}`, remote: sc.imgSource });

function extOf(url) {
  const m = /\.(png|jpe?g|webp|gif)(?:$|[?&])/i.exec(url);
  return m ? "." + m[1].toLowerCase() : ".png";
}
