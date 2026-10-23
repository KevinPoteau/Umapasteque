// One support card, laid out like the v1 Notion callout.
import { VERDICTS, typeIcon, cardImage, SP_ICON } from "./config.js";
import { img } from "./util.js";

const stars = n =>
  `<span class="stars" aria-label="${n} of 5">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>`;

const bonusIcon = stat => stat === "SP" ? img(SP_ICON, 'alt=""') : `<img src="${typeIcon(stat)}" alt="">`;

export function cardHTML(c) {
  const v = VERDICTS[c.rank];
  const bonus = c.bonus.map(([stat, val]) => `<span>${bonusIcon(stat)}${val}<em>${stat}</em></span>`).join("");

  return `<article class="card" style="--tint:var(--t-${c.color})">
  <header>
    <h3><img class="tico" src="${typeIcon(c.type)}" alt="${c.type}">${c.name} <span class="sub">· ${c.rarity} ${c.type}</span></h3>
    <div class="meta">${c.universal ? '<span class="uni">universal</span>' : ""}</div>
  </header>
  ${c.effects ? `<div class="eff">${c.effects}<small>${c.start}</small></div>` : ""}
  <div class="body">
    <div class="left">
      <div class="art">${img(cardImage(c), `alt="${c.name}" loading="lazy" data-placeholder`)}</div>
      <div class="box rate">
        <div><b>Stats</b>${stars(c.stats)}</div>
        <div><b>Skills</b>${stars(c.skills)}</div>
        <div><b>Longevity</b>${c.longevity}</div>
      </div>
    </div>
    <div class="right">
      ${c.unique ? `<div class="box"><h4><span class="gold">★</span> Unique</h4>${c.unique}</div>` : ""}
      ${c.keyskills.length ? `<div class="box"><h4>Key skills</h4><ul>${c.keyskills.map(s => `<li>${s}</li>`).join("")}</ul></div>` : ""}
      <div class="box verdict" style="--vc:var(${v ? v.color : "--v0"})">
        <span class="vpill">${v ? `<img src="${v.icon}" alt="">${v.label}` : "Unrated"}</span>
        ${c.verdict.map(p => `<p>${p}</p>`).join("")}
      </div>
    </div>
  </div>
  ${bonus ? `<div class="bonus">${bonus}</div>` : ""}
</article>`;
}
