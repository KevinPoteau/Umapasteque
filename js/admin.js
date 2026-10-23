// Admin page: list of entries to rate, a rating form with a live card preview,
// and "Publish" → one pull request with every change made in this session.
//
// Data: one file per kind (data/support.json, data/uma.json). An entry only
// appears on the running styles listed in its "roles"; adding a style is an
// explicit action here, so a card never lands on a page by accident.
//
// Edits are kept as patches of top-level fields ({ kind: { id: { field: value } } },
// "roles" being replaced as a whole) in this browser's local storage, so nothing
// is lost on reload and a patch still applies if the file changed on GitHub.
import { KINDS, ROLES, VERDICTS, ROLE_FIELDS, dataPath, rankOf, forRole, roleById, cardImage, umaImage } from "./config.js";
import { supportCardHTML, umaCardHTML } from "./card.js";
import { $, $$, img, fmtDate } from "./util.js";
import * as gh from "./github.js";

const DRAFT_KEY = "uma-admin-drafts-v2";
const VIEW_KEY = "uma-admin-view-v2";

const files = {};        // kind → { data: [...], sha } as on main
let drafts = load(DRAFT_KEY, {});
const view = { kind: "support", role: "all", scope: "todo", q: "", sel: null, edRole: null, ...load(VIEW_KEY, {}) };

function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } }

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// (the deploy step adds ?v=… to data URLs; the GitHub API wants the bare path)
const pathOf = kind => dataPath(kind).split("?")[0];

// ---------- data ----------

/** Fresh copy from main through the API (falls back to the deployed file). */
async function loadKind(kind) {
  if (files[kind]) return files[kind];
  const p = pathOf(kind);
  try {
    files[kind] = await gh.readJSON(p);
  } catch (err) {
    console.warn(err);
    const r = await fetch(p, { cache: "no-store" });
    files[kind] = { data: await r.json(), sha: null };
  }
  return files[kind];
}

/** An entry with this session's patch applied (null = field removed). */
function current(kind, item) {
  const out = { ...item, ...(drafts[kind]?.[item.id] ?? {}) };
  for (const k of Object.keys(out)) if (out[k] === null) delete out[k];
  return out;
}
const rolesOf = it => Object.keys(it.roles ?? {});
const isTodo = it => it.todo === true || !rolesOf(it).length || rolesOf(it).some(r => rankOf(it.roles[r]) == null);
const isChanged = (kind, id) => !!drafts[kind]?.[id];
const changeCount = () => Object.values(drafts).reduce((n, d) => n + Object.keys(d).length, 0);

function patch(kind, original, fields) {
  const d = (drafts[kind] ??= {});
  const next = { ...(d[original.id] ?? {}), ...fields };
  // keep only fields that really differ from main (null = remove the field)
  const same = (a, b) => (a ?? null) === null ? (b ?? null) === null : JSON.stringify(a) === JSON.stringify(b);
  for (const k of Object.keys(next)) if (same(next[k], original[k])) delete next[k];
  if (Object.keys(next).length) d[original.id] = next; else delete d[original.id];
  if (!Object.keys(d).length) delete drafts[kind];
  store(DRAFT_KEY, drafts);
  syncPublish();
}

// ---------- header controls ----------

function renderControls() {
  $("#a-kinds").innerHTML = Object.entries(KINDS).map(([k, v]) =>
    `<a href="#" data-kind="${k}" ${k === view.kind ? 'aria-current="page"' : ""}><img src="${v.art}" alt="" style="object-position:${v.focus}"><span>${v.label}</span></a>`).join("");
  $("#a-role").innerHTML = [["all", "All running styles"], ...ROLES.map(r => [r.id, r.label]), ["none", "No running style yet"]]
    .map(([id, label]) => `<option value="${id}" ${id === view.role ? "selected" : ""}>${label}</option>`).join("");
  $$("#a-scope button").forEach(b => b.setAttribute("aria-pressed", b.dataset.scope === view.scope));
  $("#a-q").value = view.q;
}

function syncPublish() {
  const n = changeCount();
  const b = $("#publish");
  b.disabled = !n;
  b.textContent = n ? `Publish ${n} change${n > 1 ? "s" : ""}` : "Publish";
}

// ---------- list ----------

async function renderList() {
  store(VIEW_KEY, { kind: view.kind, role: view.role, scope: view.scope });
  const kind = view.kind;
  const list = $("#list");
  list.innerHTML = '<p class="empty">Loading…</p>';
  const { data } = await loadKind(kind);
  if (kind !== view.kind) return;   // switched while loading

  const q = view.q.trim().toLowerCase();
  const inRole = it => view.role === "all" || (view.role === "none" ? !rolesOf(it).length : !!it.roles?.[view.role]);
  const pool = data.map(item => current(kind, item)).filter(inRole);
  const rows = pool
    .filter(it => view.scope === "all" || (view.scope === "todo" ? isTodo(it) : isChanged(kind, it.id)))
    .filter(it => !q || `${it.name} ${it.outfit ?? ""} ${it.type ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => b.iso.localeCompare(a.iso));

  $("#a-count").textContent = `${rows.length} / ${pool.length}`;
  list.innerHTML = rows.length ? rows.map(it => rowHTML(kind, it)).join("") : `<p class="empty">${
    view.scope === "todo" ? 'Nothing left to rate here. <button class="link" data-scope="all">Show all</button>'
    : view.scope === "changed" ? "No changes here yet." : "No entry matches."}</p>`;
}

/** Small running-style badges, ringed with the colour of that style's verdict. */
const roleBadges = it => rolesOf(it).map(r => {
  const v = VERDICTS[rankOf(it.roles[r])];
  return `<span class="rb" style="--vc:var(${v ? v.color : "--v0"})" title="${roleById(r).label}: ${v ? v.label : "Unrated"}">${img(roleById(r).icon, 'alt=""')}</span>`;
}).join("") || '<span class="none">no style</span>';

function rowHTML(kind, it) {
  const pic = kind === "support" ? cardImage(it) : umaImage(it);
  const sub = kind === "support" ? `${it.rarity} ${it.type}` : it.outfit;
  return `<button class="row${it.id === view.sel ? " on" : ""}" data-id="${it.id}" style="--tint:var(--t-${it.color})">
    <span class="thumb">${img(pic, 'alt="" loading="lazy"')}</span>
    <span class="txt"><b>${esc(it.name)}</b><small>${esc(sub)} · ${fmtDate(it.iso)}</small></span>
    ${isChanged(kind, it.id) ? '<span class="dot" title="Changed in this session"></span>' : ""}
    <span class="rbs">${roleBadges(it)}</span>
  </button>`;
}

// ---------- editor ----------

const starsInput = (field, value) => `<div class="stars-in" data-field="${field}" role="radiogroup">${
  [1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" aria-label="${n} of 5" class="${n <= value ? "on" : ""}">★</button>`).join("")
}</div>`;

/** A new running style starts unrated; support cards reuse the stat bonus of another style. */
function newRole(kind, it) {
  if (kind === "uma") return { verdict: [] };
  const other = Object.values(it.roles ?? {})[0];
  return { verdict: [], stats: 0, skills: 0, longevity: "", bonus: other?.bonus ?? [] };
}

async function renderEditor() {
  const ed = $("#editor");
  const kind = view.kind;
  const { data } = await loadKind(kind);
  const original = data.find(x => x.id === view.sel);
  if (!original) { ed.innerHTML = '<p class="empty">Pick an entry on the left to rate it.</p>'; return; }
  const it = current(kind, original);
  const support = kind === "support";
  const roles = rolesOf(it);
  if (!roles.includes(view.edRole)) view.edRole = roles.includes(view.role) ? view.role : roles[0] ?? null;
  const role = view.edRole;
  const R = role ? it.roles[role] : null;
  const rank = rankOf(R);

  const tabs = ROLES.map(r => roles.includes(r.id)
    ? `<button type="button" class="rtab" data-tab="${r.id}" aria-pressed="${r.id === role}">${img(r.icon, 'alt=""')}${r.label}</button>`
    : `<button type="button" class="rtab add" data-add="${r.id}" title="Show this ${KINDS[kind].noun} on the ${r.label} page">+ ${r.label}</button>`).join("");

  const rolePanel = !role ? `<p class="hint">Not shown on the site yet: add the running styles this ${KINDS[kind].noun} is good for.</p>` : `
    <fieldset>
      <legend>Verdict as ${roleById(role).label}</legend>
      <div class="vpick">${[5, 4, 3, 2, 1].map(r => `
        <button type="button" data-r="${r}" style="--vc:var(${VERDICTS[r].color})" aria-pressed="${r === rank}">
          <img src="${VERDICTS[r].icon}" alt=""><span>${VERDICTS[r].label}</span></button>`).join("")}
      </div>
    </fieldset>
    ${support ? `<fieldset class="grid2">
      <label>Stats${starsInput("stats", R.stats ?? 0)}</label>
      <label>Skills${starsInput("skills", R.skills ?? 0)}</label>
      <label>Longevity<input name="longevity" value="${esc(R.longevity)}"></label>
    </fieldset>` : ""}
    <label>Verdict text <small>(one paragraph per line, HTML allowed)</small>
      <textarea name="verdict" rows="4">${esc((R.verdict ?? []).join("\n"))}</textarea></label>
    <div><button type="button" class="btn danger" id="drop-role">Remove from ${roleById(role).label}</button></div>`;

  ed.innerHTML = `
  <form class="form" autocomplete="off">
    <div class="ed-head">
      <h2>${esc(it.name)} <small>${esc(support ? `${it.rarity} ${it.type}` : it.outfit)}</small></h2>
      ${isChanged(kind, it.id) ? '<button type="button" class="btn" id="revert">Undo changes</button>' : ""}
    </div>

    <fieldset>
      <legend>Running styles</legend>
      <div class="rtabs">${tabs}</div>
    </fieldset>
    <div class="role-panel">${rolePanel}</div>

    <fieldset class="shared">
      <legend>Shared by every running style</legend>
      ${support ? "" : `<div class="grid2 stars3">
        <label>Runner${starsInput("runner", it.runner ?? 0)}</label>
        <label>Inherit${starsInput("inherit", it.inherit ?? 0)}</label>
        <label>Evolved skills${starsInput("evolved", it.evolved ?? 0)}</label>
      </div>`}
      <div class="grid2">
        <label>Release date (for the timeline)<input name="iso" type="date" value="${esc(it.iso)}"></label>
        <label>Date label (shown on the card)<input name="date" value="${esc(it.date)}"></label>
      </div>
      <label class="check"><input name="todo" type="checkbox" ${it.todo ? "checked" : ""}> Keep in the “To rate” list</label>
    </fieldset>
  </form>
  <div class="preview"><h3>Preview${role ? ` · ${roleById(role).label}` : ""}</h3><div class="pv">${
    role ? (support ? supportCardHTML(forRole(it, role)) : umaCardHTML(forRole(it, role), role)) : '<p class="empty">No running style yet.</p>'}</div></div>`;

  const form = ed.querySelector("form");
  const redraw = () => { renderEditor(); refreshRow(); };
  const set = fields => { patch(kind, original, fields); redraw(); };
  /** Change this running style's rating; the "To rate" flag goes once every style has a verdict. */
  const setRole = fields => {
    const roles = structuredClone(it.roles);
    const merged = { ...roles[role], ...fields };
    // same field order as the rest of the file (rank, verdict, …) for clean diffs
    roles[role] = Object.fromEntries([...ROLE_FIELDS[kind].filter(k => k in merged), ...Object.keys(merged).filter(k => !ROLE_FIELDS[kind].includes(k))].map(k => [k, merged[k]]));
    const done = Object.values(roles).every(r => rankOf(r) != null);
    set({ roles, ...(done && "rank" in fields ? { todo: null } : {}) });
  };

  form.querySelectorAll(".rtab[data-tab]").forEach(b => b.onclick = () => { view.edRole = b.dataset.tab; renderEditor(); });
  form.querySelectorAll(".rtab[data-add]").forEach(b => b.onclick = () => {
    const roles = structuredClone(it.roles ?? {});
    roles[b.dataset.add] = newRole(kind, it);
    // keep the usual order: front, pace, late, end
    const ordered = Object.fromEntries(ROLES.filter(r => roles[r.id]).map(r => [r.id, roles[r.id]]));
    view.edRole = b.dataset.add;
    set({ roles: ordered });
  });
  form.querySelector("#drop-role")?.addEventListener("click", () => {
    const roles = structuredClone(it.roles);
    delete roles[role];
    view.edRole = null;
    set({ roles });
  });
  form.querySelectorAll(".vpick button").forEach(b => b.onclick = () => setRole({ rank: +b.dataset.r }));
  form.querySelectorAll(".stars-in").forEach(g => g.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    const f = g.dataset.field, n = +b.dataset.n;
    ROLE_FIELDS[kind].includes(f) ? setRole({ [f]: n }) : set({ [f]: n });
  });
  form.querySelector("#revert")?.addEventListener("click", () => {
    delete drafts[kind][original.id];
    if (!Object.keys(drafts[kind]).length) delete drafts[kind];
    store(DRAFT_KEY, drafts); syncPublish(); redraw();
  });
  // Text fields: save on change (when leaving the field), not on every key
  form.addEventListener("change", e => {
    const el = e.target;
    if (el.name === "verdict") setRole({ verdict: el.value.split("\n").map(s => s.trim()).filter(Boolean) });
    else if (el.name === "longevity") setRole({ longevity: el.value.trim() });
    else if (el.name === "todo") set({ todo: el.checked || null });
    else if (el.name === "iso") { if (el.value) set({ iso: el.value }); }
    else if (el.name === "date") set({ date: el.value.trim() });
  });
}

/** Update the selected row in place (keeps the list scroll position). */
async function refreshRow() {
  const kind = view.kind;
  const { data } = await loadKind(kind);
  const original = data.find(x => x.id === view.sel);
  const row = $(`#list .row[data-id="${view.sel}"]`);
  if (original && row) row.outerHTML = rowHTML(kind, current(kind, original));
}

// ---------- publish ----------

/** What changed in one entry, for the pull request description. */
function describe(before, after) {
  const out = [];
  const b = before.roles ?? {}, a = after.roles ?? {};
  for (const r of ROLES.map(x => x.id)) {
    if (!b[r] && a[r]) out.push(`+${r}${a[r].rank ? ` ${VERDICTS[a[r].rank].label}` : ""}`);
    else if (b[r] && !a[r]) out.push(`−${r}`);
    else if (b[r] && JSON.stringify(b[r]) !== JSON.stringify(a[r])) {
      const f = Object.keys({ ...b[r], ...a[r] }).filter(k => JSON.stringify(b[r][k]) !== JSON.stringify(a[r][k]));
      out.push(`${r}: ${f.includes("rank") ? `${VERDICTS[a[r].rank]?.label ?? "unrated"}, ` : ""}${f.filter(k => k !== "rank").join(", ") || "verdict"}`.replace(/, $/, ""));
    }
  }
  for (const k of Object.keys({ ...before, ...after })) if (k !== "roles" && JSON.stringify(before[k]) !== JSON.stringify(after[k])) out.push(k);
  return out.join(" · ");
}

async function doPublish() {
  if (!gh.getToken()) { openToken(); return; }
  const btn = $("#publish");
  btn.disabled = true; btn.textContent = "Publishing…";
  try {
    const kinds = Object.keys(drafts);
    for (const k of kinds) { delete files[k]; await loadKind(k); }   // latest main
    const out = kinds.map(k => ({ path: pathOf(k), content: JSON.stringify(files[k].data.map(item => current(k, item)), null, 1) + "\n" }));

    const lines = kinds.flatMap(k => Object.keys(drafts[k]).map(id => {
      const item = files[k].data.find(x => String(x.id) === id);
      if (!item) return `- ${k} ${id}: entry no longer on main, skipped`;
      return `- **${item.name}**${item.outfit ? ` (${item.outfit})` : ` (${item.rarity} ${item.type})`}: ${describe(item, current(k, item))}`;
    }));
    const n = lines.length;
    const url = await gh.publish(out, {
      title: `Ratings: ${n} entr${n > 1 ? "ies" : "y"}`,
      body: `Changes made on the admin page.\n\n${lines.join("\n")}\n`,
    });

    drafts = {}; store(DRAFT_KEY, drafts);
    for (const k of kinds) delete files[k];
    toast(`Pull request opened: <a href="${url}" target="_blank" rel="noopener">${url.replace(/^https:\/\/github\.com\//, "")}</a> — merge it to update the site.`);
    await renderList(); await renderEditor();
  } catch (err) {
    console.error(err);
    toast(`Publishing failed: ${esc(err.message)}`, true);
  }
  syncPublish();
}

function toast(html, bad = false) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.append(t); }
  t.className = bad ? "bad" : "";
  t.innerHTML = `<span>${html}</span><button aria-label="Close">×</button>`;
  t.querySelector("button").onclick = () => t.remove();
}

// ---------- token ----------

function openToken() {
  $("#token-in").value = gh.getToken();
  $("#token-dlg").showModal();
}

async function showWho() {
  const who = $("#who");
  if (!gh.getToken()) { who.textContent = "Not signed in"; who.className = "who off"; return; }
  try { who.textContent = `@${await gh.whoAmI()}`; who.className = "who"; }
  catch { who.textContent = "Token refused"; who.className = "who bad"; }
}

// ---------- events ----------

$("#a-kinds").addEventListener("click", e => {
  const a = e.target.closest("a[data-kind]"); if (!a) return;
  e.preventDefault();
  view.kind = a.dataset.kind; view.sel = null;
  renderControls(); renderList(); renderEditor();
});
$("#a-role").onchange = e => { view.role = e.target.value; renderList(); };
$("#a-scope").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  view.scope = b.dataset.scope; renderControls(); renderList();
};
$("#a-q").oninput = e => { view.q = e.target.value; renderList(); };
$("#list").addEventListener("click", e => {
  const s = e.target.closest("[data-scope]");
  if (s) { view.scope = s.dataset.scope; renderControls(); renderList(); return; }
  const row = e.target.closest(".row"); if (!row) return;
  view.sel = +row.dataset.id; view.edRole = null;
  $$("#list .row").forEach(r => r.classList.toggle("on", r === row));
  renderEditor();
});
$("#publish").onclick = doPublish;
$("#token-btn").onclick = openToken;
$("#token-dlg").addEventListener("close", () => {
  const dlg = $("#token-dlg");
  if (dlg.returnValue === "save") gh.setToken($("#token-in").value.trim());
  if (dlg.returnValue === "clear") gh.setToken("");
  showWho();
});

renderControls();
syncPublish();
showWho();
renderList();
renderEditor();
