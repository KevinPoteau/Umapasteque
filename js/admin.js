// Admin page: list of entries to rate, a rating form with a live card preview,
// and "Publish" → one pull request with every change made in this session.
//
// Edits are kept as small patches ({ file: { id: { field: value } } }) in this
// browser's local storage, so nothing is lost on reload and a patch still
// applies if the file changed on GitHub in the meantime.
import { KINDS, ROLES, VERDICTS, dataPath, rankOf, cardImage, umaImage } from "./config.js";
import { supportCardHTML, umaCardHTML } from "./card.js";
import { $, $$, img, fmtDate } from "./util.js";
import * as gh from "./github.js";

const DRAFT_KEY = "uma-admin-drafts";
const VIEW_KEY = "uma-admin-view";

const files = {};        // path → { data: [...], sha } as on main
let drafts = load(DRAFT_KEY, {});
const view = { kind: "support", role: "front", scope: "todo", q: "", sel: null, ...load(VIEW_KEY, {}) };

function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } }

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// (the deploy step adds ?v=… to data URLs; the GitHub API wants the bare path)
const path = () => dataPath(view.kind, view.role).split("?")[0];

// ---------- data ----------

/** Fresh copy from main through the API (falls back to the deployed file). */
async function loadFile(p) {
  if (files[p]) return files[p];
  try {
    files[p] = await gh.readJSON(p);
  } catch (err) {
    console.warn(err);
    const r = await fetch(p, { cache: "no-store" });
    files[p] = { data: await r.json(), sha: null };
  }
  return files[p];
}

/** An entry with this session's patch applied. */
const withDraft = (p, item) => ({ ...item, ...(drafts[p]?.[item.id] ?? {}) });
const isTodo = item => item.todo === true || rankOf(item) == null;
const isChanged = (p, id) => !!drafts[p]?.[id];
const changeCount = () => Object.values(drafts).reduce((n, d) => n + Object.keys(d).length, 0);

function patch(p, original, fields) {
  const d = (drafts[p] ??= {});
  const next = { ...(d[original.id] ?? {}), ...fields };
  // keep only fields that really differ from main
  // null = remove the field (undefined would be lost in local storage)
  const same = (a, b) => (a ?? null) === null ? (b ?? null) === null : JSON.stringify(a) === JSON.stringify(b);
  for (const k of Object.keys(next)) if (same(next[k], original[k])) delete next[k];
  if (Object.keys(next).length) d[original.id] = next; else delete d[original.id];
  if (!Object.keys(d).length) delete drafts[p];
  store(DRAFT_KEY, drafts);
  syncPublish();
}

// ---------- header controls ----------

function renderControls() {
  $("#a-kinds").innerHTML = Object.entries(KINDS).map(([k, v]) =>
    `<a href="#" data-kind="${k}" ${k === view.kind ? 'aria-current="page"' : ""}><img src="${v.art}" alt="" style="object-position:${v.focus}"><span>${v.label}</span></a>`).join("");
  $("#a-role").innerHTML = ROLES.map(r => `<option value="${r.id}" ${r.id === view.role ? "selected" : ""}>${r.label}</option>`).join("");
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
  const p = path();
  const list = $("#list");
  list.innerHTML = '<p class="empty">Loading…</p>';
  const { data } = await loadFile(p);
  if (p !== path()) return;   // switched page while loading

  const q = view.q.trim().toLowerCase();
  const rows = data
    .map(item => withDraft(p, item))
    .filter(it => view.scope === "all" || (view.scope === "todo" ? isTodo(it) : isChanged(p, it.id)))
    .filter(it => !q || `${it.name} ${it.outfit ?? ""} ${it.type ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => b.iso.localeCompare(a.iso));

  $("#a-count").textContent = `${rows.length} / ${data.length}`;
  list.innerHTML = rows.length ? rows.map(it => rowHTML(p, it)).join("") : `<p class="empty">${
    view.scope === "todo" ? 'Nothing left to rate here. <button class="link" data-scope="all">Show all</button>'
    : view.scope === "changed" ? "No changes on this page yet." : "No entry matches."}</p>`;
}

function rowHTML(p, it) {
  const v = VERDICTS[rankOf(it)];
  const pic = view.kind === "support" ? cardImage(it) : umaImage(it);
  const sub = view.kind === "support" ? `${it.rarity} ${it.type}` : it.outfit;
  return `<button class="row${it.id === view.sel ? " on" : ""}" data-id="${it.id}" style="--tint:var(--t-${it.color})">
    <span class="thumb">${img(pic, 'alt="" loading="lazy"')}</span>
    <span class="txt"><b>${esc(it.name)}</b><small>${esc(sub)} · ${fmtDate(it.iso)}</small></span>
    ${isChanged(p, it.id) ? '<span class="dot" title="Changed in this session"></span>' : ""}
    ${it.todo ? '<span class="todo">to rate</span>' : ""}
    <span class="v" title="${v ? v.label : "Unrated"}">${v ? `<img src="${v.icon}" alt="${v.label}">` : "?"}</span>
  </button>`;
}

// ---------- editor ----------

const starsInput = (field, value) => `<div class="stars-in" data-field="${field}" role="radiogroup">${
  [1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" aria-label="${n} of 5" class="${n <= value ? "on" : ""}">★</button>`).join("")
}</div>`;

async function renderEditor() {
  const ed = $("#editor");
  const p = path();
  const { data } = await loadFile(p);
  const original = data.find(x => x.id === view.sel);
  if (!original) { ed.innerHTML = '<p class="empty">Pick an entry on the left to rate it.</p>'; return; }
  const it = withDraft(p, original);
  const rank = rankOf(it);
  const support = view.kind === "support";
  const starFields = support ? [["stats", "Stats"], ["skills", "Skills"]] : [["runner", "Runner"], ["inherit", "Inherit"], ["evolved", "Evolved skills"]];

  ed.innerHTML = `
  <form class="form" autocomplete="off">
    <div class="ed-head">
      <h2>${esc(it.name)} <small>${esc(support ? `${it.rarity} ${it.type}` : it.outfit)}</small></h2>
      ${isChanged(p, it.id) ? '<button type="button" class="btn" id="revert">Undo changes</button>' : ""}
    </div>

    <fieldset>
      <legend>Verdict</legend>
      <div class="vpick">${[5, 4, 3, 2, 1].map(r => `
        <button type="button" data-r="${r}" style="--vc:var(${VERDICTS[r].color})" aria-pressed="${r === rank}">
          <img src="${VERDICTS[r].icon}" alt=""><span>${VERDICTS[r].label}</span></button>`).join("")}
      </div>
    </fieldset>

    <fieldset class="grid2">
      ${starFields.map(([f, l]) => `<label>${l}${starsInput(f, it[f] ?? 0)}</label>`).join("")}
      ${support ? `<label>Longevity<input name="longevity" value="${esc(it.longevity)}"></label>` : ""}
    </fieldset>

    <label>Verdict text <small>(one paragraph per line, HTML allowed)</small>
      <textarea name="verdict" rows="4">${esc((it.verdict ?? []).join("\n"))}</textarea></label>

    <fieldset class="grid2">
      <label>Release date (for the timeline)<input name="iso" type="date" value="${esc(it.iso)}"></label>
      <label>Date label (shown on the card)<input name="date" value="${esc(it.date)}"></label>
    </fieldset>

    <label class="check"><input name="todo" type="checkbox" ${it.todo ? "checked" : ""}> Keep in the “To rate” list</label>
  </form>
  <div class="preview"><h3>Preview</h3><div class="pv">${support ? supportCardHTML(it) : umaCardHTML(it, view.role)}</div></div>`;

  const form = ed.querySelector("form");
  const set = fields => { patch(p, original, fields); renderEditor(); refreshRow(); };

  form.querySelectorAll(".vpick button").forEach(b => b.onclick = () => {
    // An explicit rank replaces the old Notion emoji key
    set({ rank: +b.dataset.r, verdictKey: null, todo: null });
  });
  form.querySelectorAll(".stars-in").forEach(g => g.onclick = e => {
    const b = e.target.closest("button"); if (b) set({ [g.dataset.field]: +b.dataset.n });
  });
  form.querySelector("#revert")?.addEventListener("click", () => {
    delete drafts[p][original.id];
    if (!Object.keys(drafts[p]).length) delete drafts[p];
    store(DRAFT_KEY, drafts); syncPublish(); renderEditor(); refreshRow();
  });
  // Text fields: save on change (when leaving the field), not on every key
  form.addEventListener("change", e => {
    const el = e.target;
    if (el.name === "verdict") set({ verdict: el.value.split("\n").map(s => s.trim()).filter(Boolean) });
    else if (el.name === "todo") set({ todo: el.checked || null });
    else if (el.name === "iso") { if (el.value) set({ iso: el.value }); }
    else if (el.name) set({ [el.name]: el.value.trim() });
  });
}

/** Update the selected row in place (keeps the list scroll position). */
async function refreshRow() {
  const p = path();
  const { data } = await loadFile(p);
  const original = data.find(x => x.id === view.sel);
  const row = $(`#list .row[data-id="${view.sel}"]`);
  if (original && row) row.outerHTML = rowHTML(p, withDraft(p, original));
}

// ---------- publish ----------

/** Apply the patches to a file. null removes the field. */
function applied(p) {
  return files[p].data.map(item => {
    const d = drafts[p]?.[item.id];
    if (!d) return item;
    const out = { ...item };
    for (const [k, v] of Object.entries(d)) v === undefined || v === null ? delete out[k] : (out[k] = v);
    return out;
  });
}

async function doPublish() {
  if (!gh.getToken()) { openToken(); return; }
  const btn = $("#publish");
  btn.disabled = true; btn.textContent = "Publishing…";
  try {
    const paths = Object.keys(drafts);
    for (const p of paths) { delete files[p]; await loadFile(p); }   // latest main
    const out = paths.map(p => ({ path: p, content: JSON.stringify(applied(p), null, 1) + "\n" }));

    const lines = paths.flatMap(p => Object.keys(drafts[p]).map(id => {
      const item = files[p].data.find(x => String(x.id) === id) ?? { name: id };
      const it = withDraft(p, item), v = VERDICTS[rankOf(it)];
      return `- \`${p}\` · **${item.name}**${item.outfit ? ` (${item.outfit})` : ""} → ${v ? v.label : "unrated"} (${Object.keys(drafts[p][id]).join(", ")})`;
    }));
    const n = lines.length;
    const url = await gh.publish(out, {
      title: `Ratings: ${n} entr${n > 1 ? "ies" : "y"}`,
      body: `Changes made on the admin page.\n\n${lines.join("\n")}\n`,
    });

    drafts = {}; store(DRAFT_KEY, drafts);
    for (const p of paths) delete files[p];
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
$("#a-role").onchange = e => { view.role = e.target.value; view.sel = null; renderList(); renderEditor(); };
$("#a-scope").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  view.scope = b.dataset.scope; renderControls(); renderList();
};
$("#a-q").oninput = e => { view.q = e.target.value; renderList(); };
$("#list").addEventListener("click", e => {
  const s = e.target.closest("[data-scope]");
  if (s) { view.scope = s.dataset.scope; renderControls(); renderList(); return; }
  const row = e.target.closest(".row"); if (!row) return;
  view.sel = +row.dataset.id;
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
