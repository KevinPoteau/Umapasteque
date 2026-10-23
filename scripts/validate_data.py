#!/usr/bin/env python3
"""Check data/*.json before it reaches the site (runs on every pull request and deploy).

Catches typos and broken entries: unknown fields, missing fields, a running
style that does not exist, a verdict outside 1-5, a date in the wrong format,
a scenario or colour the site does not know, two entries with the same id.

An entry only shows on the running styles listed in its "roles": nothing here
guesses a style, so a card can only appear where someone rated it.

Usage:  python3 scripts/validate_data.py      (exit code 1 if anything is wrong)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROLES = {"front", "pace", "late", "end"}
COLORS = {"blue", "red", "orange", "pink", "green", "yellow", "purple", "brown"}  # --t-* in css/base.css
TYPES = {"Speed", "Stamina", "Power", "Guts", "Wit", "Pal", "Group"}
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")

errors = []


def err(where, msg):
    errors.append(f"{where}: {msg}")


def is_str(v): return isinstance(v, str)
def is_bool(v): return isinstance(v, bool)
def is_star(v): return isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= 5
def is_strs(v): return isinstance(v, list) and all(isinstance(x, str) for x in v)
def is_id(v): return isinstance(v, int) and not isinstance(v, bool) and v > 0
def is_iso(v): return isinstance(v, str) and bool(ISO.match(v))
def is_bonus(v): return isinstance(v, list) and all(isinstance(b, list) and len(b) == 2 and all(isinstance(x, str) for x in b) for b in v)
def is_skills(v):
    return isinstance(v, list) and all(
        isinstance(s, dict) and is_str(s.get("html")) and set(s) <= {"html", "sub"} and is_strs(s.get("sub", []))
        for s in v)
def is_rank(v): return v is None or (isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= 5)


# field → (required?, check)
SHARED = {
    "id": (True, is_id), "name": (True, is_str), "color": (True, lambda v: v in COLORS),
    "date": (True, is_str), "iso": (True, is_iso), "scenario": (True, None),  # checked against scenarios.json
    "imgSource": (True, is_str), "keyskills": (True, is_skills), "roles": (True, None),
    "todo": (False, is_bool),
}
FIELDS = {
    "support": {
        **SHARED,
        "rarity": (True, lambda v: v in {"SSR", "SR", "R"}), "type": (True, lambda v: v in TYPES),
        "universal": (True, is_bool), "effects": (True, is_str), "start": (True, is_str), "unique": (True, is_str),
        "bonus": (False, is_bonus),   # shared stat bonus; a running style can override it
    },
    "uma": {
        **SHARED,
        "outfit": (True, is_str), "style": (True, lambda v: v in ROLES),
        "runner": (True, is_star), "inherit": (True, is_star), "evolved": (True, is_star),
        "aptitudes": (True, is_strs), "bonus": (True, is_bonus),
    },
}
# fields allowed inside roles.<style> (they override the shared ones on that page)
ROLE_FIELDS = {
    "support": {"rank": is_rank, "verdict": is_strs, "stats": is_star, "skills": is_star, "longevity": is_str, "bonus": is_bonus},
    "uma": {"rank": is_rank, "verdict": is_strs, "runner": is_star, "inherit": is_star, "evolved": is_star, "bonus": is_bonus},
}


def check_scenarios():
    path = ROOT / "data" / "scenarios.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    names = set()
    for i, s in enumerate(data):
        where = f"scenarios.json #{i + 1}"
        for f in ("name", "slug", "start", "color", "imgSource"):
            if f not in s:
                err(where, f"missing {f}")
        if "gt" in s and not is_id(s["gt"]):
            err(where, f"gt should be GameTora's scenario id, got {s['gt']!r}")
        for f in s.keys() - {"name", "slug", "gt", "start", "color", "imgSource"}:
            err(where, f"unknown field {f!r}")
        if not is_iso(s.get("start")):
            err(where, f"start should be YYYY-MM-DD, got {s.get('start')!r}")
        names.add(s.get("name"))
    return names


def check_kind(kind, scenarios):
    path = ROOT / "data" / f"{kind}.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        err(path.name, f"cannot be read: {e}")
        return
    if not isinstance(data, list):
        err(path.name, "should be a list of entries")
        return
    fields, seen = FIELDS[kind], {}
    for i, item in enumerate(data):
        where = f"{path.name} #{i + 1} ({item.get('name', '?')})"
        for f, (required, ok) in fields.items():
            if f not in item:
                if required:
                    err(where, f"missing {f}")
            elif ok and not ok(item[f]):
                err(where, f"bad {f}: {item[f]!r}")
        for f in item.keys() - fields.keys():
            err(where, f"unknown field {f!r}")
        if item.get("scenario") not in scenarios:
            err(where, f"unknown scenario {item.get('scenario')!r} (see data/scenarios.json)")
        if item.get("id") in seen:
            err(where, f"same id as #{seen[item['id']]}")
        seen.setdefault(item.get("id"), i + 1)

        roles = item.get("roles")
        if not isinstance(roles, dict):
            err(where, "roles should be an object like {\"pace\": {…}}")
            continue
        for role, r in roles.items():
            rw = f"{where} roles.{role}"
            if role not in ROLES:
                err(rw, f"unknown running style (use {', '.join(sorted(ROLES))})")
            if not isinstance(r, dict):
                err(rw, "should be an object")
                continue
            for f, v in r.items():
                ok = ROLE_FIELDS[kind].get(f)
                if not ok:
                    err(rw, f"unknown field {f!r}")
                elif not ok(v):
                    err(rw, f"bad {f}: {v!r}")
            if kind == "support":
                for f in ("verdict", "stats", "skills", "longevity"):
                    if f not in r:
                        err(rw, f"missing {f}")
            elif "verdict" not in r:
                err(rw, "missing verdict")
            if kind == "support" and "bonus" not in r and "bonus" not in item:
                err(rw, "missing bonus (here or shared)")
    print(f"{path.name}: {len(data)} entries, "
          + ", ".join(f"{r} {sum(1 for x in data if r in (x.get('roles') or {}))}" for r in ("front", "pace", "late", "end")))


def check_ignored():
    """data/ignored.json: ids the import must skip ("Don't track" on the admin page)."""
    path = ROOT / "data" / "ignored.json"
    if not path.exists():
        return
    d = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(d, dict) or set(d) - {"support", "uma"}:
        err(path.name, 'should look like {"support": [ids], "uma": [ids]}')
        return
    for k, ids in d.items():
        if not (isinstance(ids, list) and all(is_id(i) for i in ids)):
            err(path.name, f"{k} should be a list of ids")


scenarios = check_scenarios()
check_ignored()
for kind in ("support", "uma"):
    check_kind(kind, scenarios)

if errors:
    print(f"\n{len(errors)} problem(s):", *errors, sep="\n  ")
    sys.exit(1)
print("data OK")
