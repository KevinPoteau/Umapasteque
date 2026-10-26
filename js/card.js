// Card markup, laid out like the v1 Notion callouts.
//   supportCardHTML(card): support card
//   umaCardHTML(uma):      Uma (character)
import { VERDICTS, rankOf, typeIcon, cardImage, umaImage, SP_ICON, roleById, cardLink, umaLink } from "./config.js";
import { img } from "./util.js";

// ---------- shared pieces ----------

const stars = n =>
  `<span class="stars" aria-label="${n} of 5">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>`;

const ratings = rows =>
  `<div class="box rate">${rows.map(([label, value]) => `<div><b>${label}</b>${value}</div>`).join("")}</div>`;

/**
 * A skill line that starts with its name ("<b>Name</b> – effect<br />conditions"):
 * the name + effect part is kept on one line (js/timeline.js widens the card if needed).
 */
const skillLine = html => {
  if (!html.startsWith("<b>")) return html;
  const i = html.indexOf("<br />");
  const head = i < 0 ? html : html.slice(0, i), rest = i < 0 ? "" : html.slice(i);
  return `<span class="sk">${head}</span>${rest}`;
};

/** Key skills: [{html, sub: [html]}] → nested list (inherited / evolved versions under each skill). */
const skillList = skills => !skills.length ? "" : `<div class="box skills"><h4>Key skills</h4><ul>${
  skills.map(s => `<li>${skillLine(s.html)}${s.sub ? `<ul>${s.sub.map(x => `<li>${skillLine(x)}</li>`).join("")}</ul>` : ""}</li>`).join("")
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

/** A link to the card's page elsewhere, opened in a new tab. */
const ext = (href, inner, label) =>
  `<a class="ext" href="${href}" target="_blank" rel="noopener" title="${label}">${inner}</a>`;

const frame = (color, inner) => `<article class="card" style="--tint:var(--t-${color})">${inner}</article>`;

// ---------- support card ----------

export function supportCardHTML(c) {
  return frame(c.color, `
  <header>
    <h3><img class="tico" src="${typeIcon(c.type)}" alt="${c.type}">${ext(cardLink(c), c.name, "Open on uma.guide")} <span class="sub">· ${c.rarity} ${c.type}</span></h3>
    <div class="meta">${c.universal ? '<span class="uni">universal</span>' : ""}</div>
  </header>
  ${c.effects ? `<div class="eff">${c.effects}<small>${c.start}</small></div>` : ""}
  <div class="body">
    <div class="left">
      ${ext(cardLink(c), `<div class="art">${img(cardImage(c), `alt="${c.name}" loading="lazy" data-placeholder`)}</div>`, "Open on uma.guide")}
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

/** "Turf A" → tag with the grade letter coloured like in the game; anything else (e.g. "1★") stays plain */
function aptitudeTag(text) {
  const m = /^(.*) ([SA-G])$/.exec(text);
  return m ? `<span class="tag">${m[1]} <b class="grade g-${m[2]}">${m[2]}</b></span>` : `<span class="tag">${text}</span>`;
}

export function umaCardHTML(u, pageRole) {
  // An Uma listed on another style's page (e.g. a Late Surger on End Closer) shows her own badge
  const other = u.style !== pageRole ? roleById(u.style) : null;
  return frame(u.color, `
  <header>
    <h3>${ext(umaLink(u), u.name, "Open on uma.guide")} <span class="sub">· ${u.outfit}</span></h3>
    ${other ? `<div class="meta"><span class="style">${img(other.icon, 'alt=""')}${other.label}</span></div>` : ""}
  </header>
  <div class="body">
    <div class="left">
      ${ext(umaLink(u), `<div class="art uma">${img(umaImage(u), `alt="${u.name}" loading="lazy" data-placeholder`)}</div>`, "Open on uma.guide")}
      ${ratings([["Runner", stars(u.runner)], ["Inherit", stars(u.inherit)], ["Evolved skills", stars(u.evolved)]])}
    </div>
    <div class="right">
      ${skillList(u.keyskills)}
      ${u.aptitudes.length ? `<div class="box apt"><h4>Aptitudes</h4>${u.aptitudes.map(aptitudeTag).join("")}</div>` : ""}
      ${verdictBox(u)}
    </div>
  </div>
  ${bonusRow(u.bonus)}`);
}
