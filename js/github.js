// Minimal GitHub REST client for the admin page: read data files from main,
// then publish edited files as one branch + one pull request.
//
// Auth: a fine-grained personal access token limited to this repository with
// "Contents: read and write" and "Pull requests: read and write". It is kept
// in this browser only (localStorage) and sent only to api.github.com.

export const REPO = { owner: "KevinPoteau", repo: "Umapasteque", base: "main" };
const API = `https://api.github.com/repos/${REPO.owner}/${REPO.repo}`;
const TOKEN_KEY = "uma-admin-token";

export function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } }
export function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }

async function gh(path, { method = "GET", body } = {}) {
  const token = getToken();
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    let msg = `${r.status}`;
    try { msg += ` ${(await r.json()).message}`; } catch { /* ignore */ }
    throw new Error(`GitHub ${method} ${path}: ${msg}`);
  }
  return r.status === 204 ? null : r.json();
}

// UTF-8 safe base64 (data files contain ☆, é, ○…)
const toB64 = text => { const bytes = new TextEncoder().encode(text); let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), c => c.charCodeAt(0)));

/** Read a JSON file from main; returns { data, sha }. */
export async function readJSON(path) {
  path = path.split("?")[0];   // the deploy step adds ?v=… to data URLs
  const f = await gh(`/contents/${path}?ref=${REPO.base}`);
  return { data: JSON.parse(fromB64(f.content)), sha: f.sha };
}

/** Who owns the token (to check it works). */
export async function whoAmI() {
  const r = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error(`Token refused (${r.status})`);
  return (await r.json()).login;
}

/**
 * Commit every changed file to a new branch and open one pull request.
 * files: [{ path, content }]  →  returns the pull request URL.
 */
export async function publish(files, { title, body }) {
  const ref = await gh(`/git/ref/heads/${REPO.base}`);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const branch = `ratings/${stamp}`;
  await gh(`/git/refs`, { method: "POST", body: { ref: `refs/heads/${branch}`, sha: ref.object.sha } });

  for (const f of files) {
    f.path = f.path.split("?")[0];
    // sha of the file as it is on the new branch (= main at branch time)
    let sha;
    try { sha = (await gh(`/contents/${f.path}?ref=${branch}`)).sha; } catch { sha = undefined; }
    await gh(`/contents/${f.path}`, {
      method: "PUT",
      body: { message: `Ratings: update ${f.path}`, content: toB64(f.content), branch, ...(sha ? { sha } : {}) },
    });
  }

  const pr = await gh(`/pulls`, { method: "POST", body: { title, head: branch, base: REPO.base, body } });
  return pr.html_url;
}
