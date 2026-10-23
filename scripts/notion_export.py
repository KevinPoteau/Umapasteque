#!/usr/bin/env python3
"""Convert the v1 Notion planner pages (fetched as Notion-flavoured markup) into data/*.json.

Usage:  python3 scripts/notion_export.py <folder with sup_front.md … uma_end.md>

One-off migration tool: the pages are callouts laid out with columns. Each
top-level callout whose icon is a playstyle badge is one card / one Uma.
"""
import datetime as dt
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROLES = ["front", "pace", "late", "end"]

# Verdict icon → rank (5 = Highly recommended … 1 = Very bad).
# Custom Notion emojis are keyed by the 4-hex group in their id; unknown ones stay unrated.
VERDICT_RANK = {
    "importance-must": 5, "importance-good": 4, "importance-consider": 3,
    "importance-niche": 2, "importance-skip": 1,
    "8184": 1,
}
STAT = {"status_00": "Speed", "status_01": "Stamina", "status_02": "Power",
        "status_03": "Guts", "status_04": "Wit", "uma_sp_star": "SP"}
MONTHS = {m: i for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(), 1)}
FIRST_DAY = dt.date(2026, 10, 1)

OPEN = re.compile(r'^<callout icon="https://uma\.guide/img/banner-reviews/badges/playstyle-(\w+)\.webp" color="(\w+)">$')


def content(path):
    t = Path(path).read_text(encoding="utf-8")
    return t[t.index("<content>") + 10:t.index("</content>")]


def top_blocks(c):
    """Yield (offset, style, color, body) for every top-level playstyle callout."""
    lines = c.split("\n")
    offs, o = [], 0
    for ln in lines:
        offs.append(o); o += len(ln) + 1
    i = 0
    while i < len(lines):
        m = OPEN.match(lines[i])
        if not m:
            i += 1; continue
        depth, j = 0, i
        while True:
            if lines[j].startswith("<callout"): depth += 1
            if lines[j].startswith("</callout>"): depth -= 1
            if depth == 0: break
            j += 1
        yield offs[i], m.group(1), m.group(2), "\n".join(lines[i + 1:j])
        i = j + 1


def inline(s):
    """Notion inline markup → the small HTML vocabulary the site styles."""
    s = s.replace("\\~", "~").replace("\\*", "*")
    s = s.replace("<b>-</b>", "–")
    s = re.sub(r'<span color="gray">(.*?)</span>', r"<small>\1</small>", s)
    s = re.sub(r'<span color="yellow">(.*?)</span>', r'<span class="gold">\1</span>', s)
    s = re.sub(r'<span color="blue">(.*?)</span>', r'<span class="inh">\1</span>', s)
    s = re.sub(r'<span color="pink">(.*?)</span>', r'<span class="evo">\1</span>', s)
    s = re.sub(r'<span color="\w+">(.*?)</span>', r"\1", s)
    s = re.sub(r"</?p>", "", s)
    return re.sub(r"\s+", " ", s).strip()


def paragraphs(s):
    s = re.sub(r"</?p>", "\n", s)
    return [inline(p) for p in re.split(r"\n\s*\n", s) if inline(p)]


def skill_tree(block):
    """'- a\\n  - b' bullet list → [{"html": a, "sub": [b]}]."""
    out = []
    for ln in block.split("\n"):
        if ln.startswith("- "):
            out.append({"html": inline(ln[2:]), "sub": []})
        elif ln.startswith("  - ") and out:
            out[-1]["sub"].append(inline(ln[4:]))
        elif ln.strip() and out:  # continuation line
            target = out[-1]["sub"] if out[-1]["sub"] else None
            if target is not None: target[-1] += " " + inline(ln)
            else: out[-1]["html"] += " " + inline(ln)
    for s in out:
        if not s["sub"]: del s["sub"]
    return out


def stars(s):
    return s.count("★") if s and set(s.strip()) <= set("★☆") else None


def verdict(body):
    m = re.search(r'<callout icon="([^"]+)" color="gray_bg">\n(?:<p>\n)?<b>Verdict</b>\s*(.*?)\n</callout>', body, re.S)
    if not m:
        return None, None, []
    icon, text = m.group(1), m.group(2)
    if text.startswith("<b>-</b>"):
        text = text[len("<b>-</b>"):]
    elif text.startswith("<b>-"):  # "<b>- whole sentence in bold</b>"
        text = text[len("<b>-"):].replace("</b>", "", 1)
    key = re.search(r"(importance-\w+)", icon).group(1) if "importance-" in icon else icon.rsplit("/", 1)[-1].split("-")[2]
    return key, VERDICT_RANK.get(key), paragraphs(text)


def bonuses(body):
    return [[STAT[a], b.strip()] for a, b in re.findall(
        r'<callout icon="[^"]*/(status_0\d|uma_sp_star)\.png" color="gray_bg">\n<b>([^<]+)</b>', body)]


class DateGuesser:
    """Pages give "Est. Nov 12 - 26" without a year: pick the year closest to the previous card."""
    def __init__(self):
        self.last = FIRST_DAY

    def __call__(self, text):
        m = re.search(r"([A-Z][a-z]{2}) (\d+)", text)
        mo, d = MONTHS[m.group(1)], int(m.group(2))
        cands = [dt.date(y, mo, d) for y in (self.last.year - 1, self.last.year, self.last.year + 1)]
        cands = [c for c in cands if c >= FIRST_DAY - dt.timedelta(days=20)]
        best = min(cands, key=lambda c: abs((c - self.last).days))
        self.last = max(self.last, best)
        return best.isoformat()


def scenario_for(iso, scenarios):
    cur = scenarios[0]["name"]
    for s in scenarios:
        if iso >= s["start"]: cur = s["name"]
    return cur


def header(body):
    h = re.search(r'^## (.*?) <span color="gray">· (.*?)</span>', body, re.M)
    date = re.search(r'^<span color="gray">(.*?)</span>$', body, re.M).group(1)
    img = re.search(r"!\[[^\]]*\]\(([^)]+)\)", body)
    return h.group(1), h.group(2), date, img.group(1) if img else ""


def parse_support(path, scenarios):
    c = content(path)
    heads = [(m.start(), m.group(1)) for m in re.finditer(r"^# (.+?) <span", c, re.M)]
    guess, cards = DateGuesser(), []
    for off, style, color, body in top_blocks(c):
        name, sub, date, img = header(body)
        rarity, typ = sub.split(" ", 1)
        eff = re.search(r"^(.*?)<br /><span color=\"gray\">(Start:.*?)</span>$", body, re.M)
        rat = dict(re.findall(r"<b>(Stats|Skills|Longevity)</b><br />([^\n]+)", body))
        uq = re.search(r"<b>Unique</b> <b>-</b> (.*?)\n</callout>", body, re.S)
        ks = re.search(r"<b>Key skills</b>\n\n(.*?)\n</callout>", body, re.S)
        key, rank, vtext = verdict(body)
        iso = guess(date)
        section = [h for p, h in heads if p < off]
        idm = re.search(r"support_card_(\d+)", img)
        cards.append({
            "id": int(idm.group(1)) if idm else None,
            "name": name, "rarity": rarity, "type": typ, "color": color.replace("_bg", ""),
            "date": date.replace(" · universal", ""), "iso": iso, "universal": "universal" in date,
            "scenario": section[-1] if section else scenario_for(iso, scenarios),
            "effects": inline(eff.group(1)) if eff else "", "start": eff.group(2) if eff else "",
            "stats": stars(rat.get("Stats", "")) or 0, "skills": stars(rat.get("Skills", "")) or 0,
            "longevity": rat.get("Longevity", ""),
            "unique": inline(uq.group(1)) if uq else "",
            "keyskills": skill_tree(ks.group(1)) if ks else [],
            "rank": rank, "verdictKey": key, "verdict": vtext,
            "bonus": bonuses(body), "imgSource": img,
        })
    return cards


def parse_uma(path, scenarios):
    guess, umas = DateGuesser(), []
    for off, style, color, body in top_blocks(content(path)):
        name, outfit, date, img = header(body)
        rat = dict(re.findall(r"<b>(Runner|Inherit|Evolved Skills)</b><br />([^\n]+)", body))
        ks = re.search(r"<b>Key skills</b>\n\n(.*?)\n</callout>", body, re.S)
        apt = re.search(r"<b>Aptitudes</b> <b>-</b> (.*?)\n</callout>", body, re.S)
        key, rank, vtext = verdict(body)
        iso = guess(date)
        idm = re.search(r"chara_stand_\d+_(\d+)", img)
        umas.append({
            "id": int(idm.group(1)) if idm else None,
            "name": name, "outfit": outfit, "style": style, "color": color.replace("_bg", ""),
            "date": date, "iso": iso, "scenario": scenario_for(iso, scenarios),
            "runner": stars(rat.get("Runner", "")) or 0, "inherit": stars(rat.get("Inherit", "")) or 0,
            "evolved": stars(rat.get("Evolved Skills", "")) or 0,
            "keyskills": skill_tree(ks.group(1)) if ks else [],
            "aptitudes": [a.strip() for a in inline(apt.group(1)).split("·")] if apt else [],
            "rank": rank, "verdictKey": key, "verdict": vtext,
            "bonus": bonuses(body), "imgSource": img,
        })
    return umas


def main(src):
    src = Path(src)
    scenarios = json.loads((ROOT / "data" / "scenarios.json").read_text(encoding="utf-8"))
    for kind, parse in (("support", parse_support), ("uma", parse_uma)):
        out = ROOT / "data" / kind
        out.mkdir(parents=True, exist_ok=True)
        for role in ROLES:
            items = parse(src / f"{'sup' if kind == 'support' else 'uma'}_{role}.md", scenarios)
            (out / f"{role}.json").write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            unrated = sorted({str(i["verdictKey"]) for i in items if i["rank"] is None})
            print(f"{kind}/{role}: {len(items)} entries, unrated keys: {unrated or '-'}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
