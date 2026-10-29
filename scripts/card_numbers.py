"""GameTora numbers of each support card, for the rating grid on the admin page.

Writes data/numbers.json: {support id: {...}}, values at max level, the unique
effect included (it is part of what the card gives once the bond is up).

    te, spe, mood, friend, race   Training eff. %, Specialty priority, Mood %, Friendship %, Race %
    bonus                         [["Speed", 1], ["SP", 2]]  stat / skill point bonus per training
    skills                        key skills: [{name, gold, kind, value, phase, cond}]
                                  kind: accel / cs / ts / recovery / other

  python3 scripts/card_numbers.py                 fetch from gametora.com
  python3 scripts/card_numbers.py --from DIR      use files saved in DIR (tests)

scripts/import_new.py refreshes it too, so new cards get their numbers.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gametora_text as text               # noqa: E402
from import_new import load_source         # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
KIND = {31: "accel", 22: "cs", 27: "ts", 9: "recovery"}
LATE = ("Late-race", "Last spurt", "Final corner", "Final straight", "m left", "After ")


def totals(card):
    """Effect id → value at max level, plus what the unique effect adds."""
    e = dict(text.max_level(card.get("effects")))

    def add(k, v):
        if k and v:
            e[k] = e.get(k, 0) + v

    for eff in (card.get("unique") or {}).get("effects") or []:
        t = eff.get("type")
        if t == 101:
            for i in (1, 3):
                add(eff.get(f"value_{i}"), eff.get(f"value_{i + 1}"))
        elif t is not None and t < 100:
            add(t, eff.get("value"))
    return e


def skill_info(s):
    # global server's values where they differ from the Japanese ones (GameTora "loc.en")
    groups = ((s.get("loc") or {}).get("en") or {}).get("condition_groups") or s.get("condition_groups")
    g = (groups or [{}])[0]
    kind, value = "other", 0
    for eff in g.get("effects", []):
        k = KIND.get(eff.get("type"))
        if k:
            kind, value = k, eff.get("value", 0) / (100 if k == "recovery" else 10000)
            break
    cond = text.conditions_text(g.get("condition"))
    return {"name": text.skill_name(s), "gold": s.get("rarity") == 2, "kind": kind,
            "value": round(value, 2), "late": any(w in cond for w in LATE), "cond": cond}


def numbers(card, skills):
    e = totals(card)
    ids = list(dict.fromkeys((card.get("hints") or {}).get("hint_skills", []) + (card.get("event_skills") or [])))
    found = [skills[i] for i in ids if i in skills]
    found = [s for s in found if s.get("rarity") in (1, 2) and "dbf" not in (s.get("type") or [])]
    return {
        "te": e.get(8, 0), "spe": e.get(19, 0), "mood": e.get(2, 0), "friend": e.get(1, 0), "race": e.get(15, 0),
        "bonus": [[k, int(v.lstrip("+"))] for k, v in text.bonus_rows(card)],
        "skills": [skill_info(s) for s in found],
    }


def write(src):
    """data/numbers.json for every card in data/support.json; returns how many."""
    skills = {s["id"]: s for s in src["skills"]}
    gt = {c["support_id"]: c for c in src["support-cards"]}
    ours = json.loads((ROOT / "data" / "support.json").read_text(encoding="utf-8"))
    out = {str(c["id"]): numbers(gt[c["id"]], skills) for c in ours if c["id"] in gt}
    (ROOT / "data" / "numbers.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return len(out), len(ours)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="from_dir")
    args = ap.parse_args()
    print("numbers for {} of {} cards".format(*write(load_source(args.from_dir))))


if __name__ == "__main__":
    main()
