#!/usr/bin/env python3
"""Add newly announced SSR support cards and Umas to data/, to be rated.

Source: GameTora's public data files (https://gametora.com), the same data its
site uses. For the global server it gives the real release date once a card is
out, and its own prediction before that ("foresight").

What it does:
  - finds SSR support cards and Umas whose global date (real or predicted) falls
    between today and HORIZON_DAYS from today,
  - skips anything already in data/ and anything listed in data/ignored.json.
    "Already in data/" = same id, or same name (+ type for cards) with a date
    less than 3 weeks apart (our Uma ids and outfit names are not the game's),
  - fills effects, start, unique, stat bonus and key skills from GameTora
    (scripts/gametora_text.py), in the same wording as the hand-written entries,
  - adds the scenarios they will run in to data/scenarios.json when missing
    (GameTora's predicted global start date),
  - appends them with "todo": true and no running style ("roles": {}), so they
    show up in the admin page's "To rate" list and nowhere on the site until a
    running style is added there,
  - writes a summary for the pull request to import-summary.md.

It never changes a hand-written entry (it only fills the texts of entries it
imported itself, still "todo" and empty). When GameTora has a confirmed global date
that differs from ours, it is only listed in the summary.

Usage:
  python3 scripts/import_new.py                 fetch from gametora.com
  python3 scripts/import_new.py --from DIR      read saved files instead (tests)
"""
import argparse
import colorsys
import datetime as dt
import json
import re
import sys
import urllib.request
from pathlib import Path

import gametora_text as text

ROOT = Path(__file__).resolve().parent.parent
HORIZON_DAYS = 430          # how far ahead to import (about 14 months)
SAME_WINDOW = 21            # days: same name this close in time = the same entry
BASE = "https://gametora.com/data"
UA = {"User-Agent": "Umapasteque importer (weekly; github.com/KevinPoteau/Umapasteque)"}
FILES = ["support-cards", "character-cards", "characters", "skills", "scenarios", "en/foresight/predicted_releases"]

TYPES = {"speed": "Speed", "stamina": "Stamina", "power": "Power", "guts": "Guts",
         "intelligence": "Wit", "friend": "Pal", "group": "Group"}
TYPE_COLOR = {"Speed": "blue", "Stamina": "red", "Power": "orange", "Guts": "pink",
              "Wit": "green", "Pal": "yellow", "Group": "purple"}
STATS = ["Speed", "Stamina", "Power", "Guts", "Wit"]
# GameTora aptitude order → our labels
APT = ["Turf", "Dirt", "Sprint", "Mile", "Med", "Long", "Front", "Pace", "Late", "End"]
STYLES = ["front", "pace", "late", "end"]
GRADES = "SABCDEFG"


# ---------- source ----------

def load_source(from_dir):
    if from_dir:
        return {k: json.loads((Path(from_dir) / (k.replace("/", "_") + ".json")).read_text(encoding="utf-8")) for k in FILES}

    def get(url):
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
            return json.loads(r.read())

    manifest = get(f"{BASE}/manifests/umamusume.json")   # file name → content hash
    return {k: get(f"{BASE}/umamusume/{k}.{manifest[k]}.json") for k in FILES}


# ---------- helpers ----------

def iso_to_date(s):
    return dt.date.fromisoformat(s)


def label(date, estimated):
    text = f"{date:%b} {date.day}"
    return f"Est. {text}" if estimated else text


def scenario_image(url_name, offline):
    """The picture GameTora shows for a scenario (its page's og:image), or "" if not found."""
    if offline or not url_name:
        return ""
    try:
        req = urllib.request.Request(f"https://gametora.com/umamusume/scenarios/{url_name}", headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            html = r.read().decode("utf-8", "replace")
        m = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', html) \
            or re.search(r'<meta[^>]+content="([^"]+)"[^>]+property="og:image"', html)
        return m.group(1).replace("&amp;", "&") if m else ""
    except Exception:
        return ""


def add_scenarios(src, scenarios, hi, offline):
    """Append scenarios GameTora expects on the global server before `hi` and missing from ours."""
    known = {s.get("gt") for s in scenarios} | {s["slug"] for s in scenarios}
    predicted = src["en/foresight/predicted_releases"].get("scenarios", {})
    added = []
    for g in sorted(src["scenarios"], key=lambda g: g.get("order", 0)):
        if g["id"] in known or g.get("url_name") in known:
            continue
        p = predicted.get(str(g["id"]))
        if not p or not p.get("release_date") or iso_to_date(p["release_date"]) > hi:
            continue
        added.append({
            "name": g.get("name_en") or g.get("name_en_old") or g.get("url_name"),
            "slug": g.get("url_name") or f"scenario-{g['id']}", "gt": g["id"], "start": p["release_date"],
            "color": "#" + (g.get("bg_color") or "888888").lower(),
            "imgSource": scenario_image(g.get("url_name"), offline),
        })
    return added


def scenario_for(iso, scenarios):
    """The scenario running on that date (the last one started on or before it)."""
    current = scenarios[0]["name"]
    for s in sorted(scenarios, key=lambda s: s["start"]):
        if s["start"] <= iso:
            current = s["name"]
    return current


def nearest_color(hex_color):
    """Character colour → closest card background token (by hue)."""
    try:
        r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except (TypeError, ValueError):
        return "purple"
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    if s < 0.18:
        return "brown"
    hues = {"red": 0, "orange": 30, "yellow": 52, "green": 130, "blue": 215, "purple": 275, "pink": 325}
    deg = h * 360
    return min(hues, key=lambda k: min(abs(deg - hues[k]), 360 - abs(deg - hues[k])))


def near(entry, ours, key):
    """Is there an entry with the same key less than SAME_WINDOW days apart?"""
    d = iso_to_date(entry["iso"])
    return any(key(o) == key(entry) and abs((iso_to_date(o["iso"]) - d).days) < SAME_WINDOW for o in ours)


def first_image(urls):
    """The first URL that serves an image (the last one if none does)."""
    for url in urls:
        try:
            req = urllib.request.Request(url, headers=UA, method="HEAD")
            with urllib.request.urlopen(req, timeout=20) as r:
                if r.status == 200 and r.headers.get("content-type", "").startswith("image/"):
                    return url
        except Exception:
            pass
    return urls[-1]


def strip_brackets(title):
    return (title or "").strip().removeprefix("[").removesuffix("]").strip()


# ---------- build entries ----------

def global_date(item, predicted):
    """(date, estimated?) for the global server, or (None, None)."""
    if item.get("release_en"):
        return iso_to_date(item["release_en"]), False
    p = predicted.get(str(item.get("support_id") or item.get("card_id")))
    if p and p.get("release_date"):
        return iso_to_date(p["release_date"]), True
    return None, None


def new_support(c, when, est, scenarios):
    t = TYPES.get(c["type"], c["type"].title())
    iso = when.isoformat()
    return {
        "id": c["support_id"], "name": c["char_name"], "rarity": "SSR", "type": t,
        "color": TYPE_COLOR.get(t, "purple"), "date": label(when, est), "iso": iso,
        "universal": False, "scenario": scenario_for(iso, scenarios),
        "effects": "", "start": "", "unique": "", "keyskills": [], "bonus": [],
        "imgSource": f"https://uma.guide/img/card/composite/tex_support_card_{c['support_id']}_thumb.webp",
        "roles": {}, "todo": True,
    }


def fill_support(entry, c, skills):
    """Card texts from GameTora (only for imported entries, never hand-written ones)."""
    entry.update(effects=text.effects_text(c), start=text.start_text(c), unique=text.unique_text(c),
                 keyskills=text.support_keyskills(c, skills), bonus=text.bonus_rows(c))


def fill_uma(entry, u, skills):
    entry["keyskills"] = text.uma_keyskills(u, skills)


def new_uma(u, when, est, scenarios, chars):
    iso = when.isoformat()
    apt = u.get("aptitude") or []
    # her own running style: the best of the four style aptitudes
    styles = apt[6:10]
    style = STYLES[min(range(len(styles)), key=lambda i: GRADES.find(styles[i]))] if len(styles) == 4 else "pace"
    return {
        "id": u["card_id"], "name": u["name_en"], "outfit": strip_brackets(u.get("title_en_gl") or u.get("title")),
        "style": style, "color": nearest_color(chars.get(u["char_id"], {}).get("color_main")),
        "date": label(when, est), "iso": iso, "scenario": scenario_for(iso, scenarios),
        "runner": 0, "inherit": 0, "evolved": 0, "keyskills": [],
        "aptitudes": [f"{APT[i]} {g}" for i, g in enumerate(apt[:10]) if g in "SAB"],
        "bonus": [[STATS[i], f"+{v}%"] for i, v in enumerate(u.get("stat_bonus") or []) if v],
        "imgSource": f"https://uma.guide/img/uma/chara_stand_{u['char_id']}_{u['card_id']}.webp",
        "roles": {}, "todo": True,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="from_dir")
    ap.add_argument("--today", help="YYYY-MM-DD (tests)")
    args = ap.parse_args()

    today = iso_to_date(args.today) if args.today else dt.date.today()
    lo, hi = today, today + dt.timedelta(days=HORIZON_DAYS)
    src = load_source(args.from_dir)
    predicted = src["en/foresight/predicted_releases"]
    chars = {c["char_id"]: c for c in src["characters"]}
    skills = {s["id"]: s for s in src["skills"]}
    gt_support = {c["support_id"]: c for c in src["support-cards"]}
    gt_uma = {u["card_id"]: u for u in src["character-cards"]}

    sc_path = ROOT / "data" / "scenarios.json"
    scenarios = json.loads(sc_path.read_text(encoding="utf-8"))
    new_scenarios = add_scenarios(src, scenarios, hi, bool(args.from_dir))
    if new_scenarios:
        scenarios += new_scenarios
        sc_path.write_text(json.dumps(scenarios, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    ignored_path = ROOT / "data" / "ignored.json"
    ignored = json.loads(ignored_path.read_text(encoding="utf-8")) if ignored_path.exists() else {}
    summary, drift = [], []

    # --- support cards ---
    path = ROOT / "data" / "support.json"
    ours = json.loads(path.read_text(encoding="utf-8"))
    known = {c["id"]: c for c in ours}
    skip = set(ignored.get("support", []))
    added = []
    for c in src["support-cards"]:
        if c.get("rarity") != 3:
            continue
        when, est = global_date(c, predicted.get("support_cards", {}))
        if when is None:
            continue
        if c["support_id"] in known:
            mine = known[c["support_id"]]
            if not est and mine["iso"] != when.isoformat():
                drift.append(f"- {mine['name']} ({mine['type']}): ours {mine['iso']}, confirmed {when.isoformat()}")
            continue
        if c["support_id"] in skip or not (lo <= when <= hi):
            continue
        entry = new_support(c, when, est, scenarios)
        fill_support(entry, c, skills)
        if near(entry, ours, lambda e: (e["name"].lower(), e["type"])):
            continue
        added.append(entry)
    # imported earlier, before card texts were filled in
    filled = 0
    for e in ours:
        if e.get("todo") and not e.get("effects") and not e.get("keyskills") and e["id"] in gt_support:
            fill_support(e, gt_support[e["id"]], skills)
            filled += 1
    added.sort(key=lambda e: (e["iso"], e["id"]))
    if added or filled:
        path.write_text(json.dumps(ours + added, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    summary += [f"- **{e['name']}** SSR {e['type']} · {e['date']} ({e['iso']})" for e in added]
    n_support = len(added)

    # --- Umas ---
    path = ROOT / "data" / "uma.json"
    ours = json.loads(path.read_text(encoding="utf-8"))
    known_ids = {u["id"] for u in ours}
    known_names = {(u["name"].lower(), u["outfit"].lower()) for u in ours}
    skip = set(ignored.get("uma", []))
    added = []
    for u in src["character-cards"]:
        if u.get("rarity") != 3:
            continue
        when, est = global_date(u, predicted.get("char_cards", {}))
        if when is None or u["card_id"] in known_ids or u["card_id"] in skip or not (lo <= when <= hi):
            continue
        entry = new_uma(u, when, est, scenarios, chars)
        fill_uma(entry, u, skills)
        if (entry["name"].lower(), entry["outfit"].lower()) in known_names or near(entry, ours, lambda e: e["name"].lower()):
            continue
        if not args.from_dir:
            entry["imgSource"] = first_image([entry["imgSource"],
                f"https://gametora.com/images/umamusume/characters/chara_stand_{u['char_id']}_{u['card_id']}.png"])
        added.append(entry)
    for e in ours:
        if e.get("todo") and not e.get("keyskills") and e["id"] in gt_uma:
            fill_uma(e, gt_uma[e["id"]], skills)
            filled += 1
    added.sort(key=lambda e: (e["iso"], e["id"]))
    if added or filled:
        path.write_text(json.dumps(ours + added, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    summary += [f"- **{e['name']}** ({e['outfit']}) · {e['date']} ({e['iso']})" for e in added]
    n_uma = len(added)

    # --- summary for the pull request ---
    text = [f"Found {n_support} new SSR support card(s) and {n_uma} new Uma(s) "
            f"with a global date between {lo} and {hi} (source: GameTora; \"Est.\" = GameTora's prediction).",
            "", "They are marked **to rate** and have no running style yet, so the site does not show them. "
            "Open the admin page → *To rate*, add the running styles each one is good for and rate it; "
            "to stop tracking one, use *Don't track* there.", ""]
    text += summary or ["(nothing new)"]
    if new_scenarios:
        text += ["", "**New scenarios** (start = GameTora's estimate; check the name, colour and picture in data/scenarios.json):",
                 *[f"- **{x['name']}** · est. {x['start']}" + ("" if x["imgSource"] else " · no picture found") for x in new_scenarios]]
    if drift:
        text += ["", "**Confirmed global dates that differ from ours** (not changed, check by hand):", *drift]
    (ROOT / "import-summary.md").write_text("\n".join(text) + "\n", encoding="utf-8")
    print("\n".join(text))
    if filled:
        text_lines = f"\nFilled in effects / unique / key skills of {filled} entr{'y' if filled == 1 else 'ies'} imported earlier."
        (ROOT / "import-summary.md").write_text((ROOT / "import-summary.md").read_text(encoding="utf-8") + text_lines + "\n", encoding="utf-8")
    print(f"\nnew={n_support + n_uma + filled + len(new_scenarios)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
