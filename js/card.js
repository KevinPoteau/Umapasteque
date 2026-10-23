// Card markup, laid out like the v1 Notion callouts.
//   supportCardHTML(card): support card
//   umaCardHTML(uma):      Uma (character)
import { VERDICTS, rankOf, typeIcon, cardImage, umaImage, SP_ICON, roleById } from "./config.js";
import { img } from "./util.js";

// ---------- shared pieces ----------

const stars = n =>
  `<span class="stars" aria-label="${n} of 5">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>`;

const ratings = rows =>
  `<div class="box rate">${rows.map(([label, value]) => `<div><b>${label}</b>${value}</div>`).join("")}</div>`;

/** Key skills: [{html, sub: [html]}] → nested list (inherited / evolved versions under each skill). */
const skillList = skills => !skills.length ? "" : `<div class="box skills"><h4>Key skills</h4><ul>${
  skills.map(s => `<li>${s.html}${s.sub ? `<ul>${s.sub.map(x => `<li>${x}</li>`).join("")}</ul>` : ""}</li>`).join("")
}</ul></div>`;

function verdictBox(item) {
  const v = VERDICTS[rankOf(item)];
  return `<div class="box verdict" style="--vc:var(${v ? v.color : "--v0"})">
    <span class="vpill">${v ? `<img src="${v.icon}" alt="">${v.label}` : "Unrated"}</span>
    ${item.verdict.map(p => `<p>${p}</p>`).join("")}
  </div>`;
}

const bonusIcon = stat => stat === "SP" ? img(SP_ICON, 'alt=""') : `<img src="${typeIcon(stat)}" alt="">`;
const bonusRow = bonus => !bonus.length ? "" :
  `<div class="bonus">${bonus.map(([stat, val]) => `<span>${bonusIcon(stat)}${val}<em>${stat}</em></span>`).join("")}</div>`;

const frame = (color, inner) => `<article class="card" style="--tint:var(--t-${color})">${inner}</article>`;

// ---------- support card ----------

export function supportCardHTML(c) {
  return frame(c.color, `
  <header>
    <h3><img class="tico" src="${typeIcon(c.type)}" alt="${c.type}">${c.name} <span class="sub">· ${c.rarity} ${c.type}</span></h3>
    <div class="meta">${c.universal ? '<span class="uni">universal</span>' : ""}</div>
  </header>
  ${c.effects ? `<div class="eff">${c.effects}<small>${c.start}</small></div>` : ""}
  <div class="body">
    <div class="left">
      <div class="art">${img(cardImage(c), `alt="${c.name}" loading="lazy" data-placeholder`)}</div>
      ${ratings([["Stats", stars(c.stats)], ["Skills", stars(c.skills)], ["Longevity", c.longevity]])}
    </div>
    <div class="right">
      ${c.unique ? `<div class="box"><h4><span class="gold">★</span> Unique</h4>${c.unique}</div>` : ""}
      ${skillList(c.keyskills)}
      ${verdictBox(c)}
    </div>
  </div>
  ${bonusRow(c.bonus)}`);
}

// ---------- Uma ----------

export function umaCardHTML(u, pageRole) {
  // An Uma listed on another style's page (e.g. a Late Surger on End Closer) shows her own badge
  const other = u.style !== pageRole ? roleById(u.style) : null;
  return frame(u.color, `
  <header>
    <h3>${u.name} <span class="sub">· ${u.outfit}</span></h3>
    ${other ? `<div class="meta"><span class="style">${img(other.icon, 'alt=""')}${other.label}</span></div>` : ""}
  </header>
  <div class="body">
    <div class="left">
      <div class="art uma">${img(umaImage(u), `alt="${u.name}" loading="lazy" data-placeholder`)}</div>
      ${ratings([["Runner", stars(u.runner)], ["Inherit", stars(u.inherit)], ["Evolved skills", stars(u.evolved)]])}
    </div>
    <div class="right">
      ${skillList(u.keyskills)}
      ${u.aptitudes.length ? `<div class="box apt"><h4>Aptitudes</h4>${u.aptitudes.map(a => `<span>${a}</span>`).join("")}</div>` : ""}
      ${verdictBox(u)}
    </div>
  </div>
  ${bonusRow(u.bonus)}`);
}
