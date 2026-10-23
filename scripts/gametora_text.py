"""Turn GameTora's raw numbers into the short texts used on the cards.

    effects_text(card)            "Friendship 30% · Mood 30% · Race 5% · …"
    start_text(card)              "Start: Bond 15 · Pow +25"
    bonus_rows(card)              [["Wit", "+2"], ["SP", "+1"]]
    unique_text(card)             "Specialty +40 at bond 80"
    skill_line(skill, kind)       "<b><span class="gold">Name</span></b> – Acc +0.40 · 1.2s<br /><small>End · Early late-race</small>"

The wording follows the entries written by hand in data/, so imported cards
read the same way. Anything unknown is left out rather than guessed.
"""

STAT_SHORT = {1: "Spd", 2: "Sta", 3: "Pow", 4: "Guts", 5: "Wit"}
STAT_LONG = {3: "Speed", 4: "Stamina", 5: "Power", 6: "Guts", 7: "Wit"}          # support effect ids 3-7
INITIAL = {9: "Spd", 10: "Sta", 11: "Pow", 12: "Guts", 13: "Wit"}               # support effect ids 9-13
MAX_STAT = {20: "Spd", 21: "Sta", 22: "Pow", 23: "Guts", 24: "Wit"}

# Support card effects shown in the "effects" line, in this order
EFFECT_ORDER = [1, 2, 8, 15, 16, 19, "hint", 31, 25, 26, 27, 28, 29, 20, 21, 22, 23, 24, 33, 41]
EFFECT_LABEL = {
    1: "Friendship {}%", 2: "Mood {}%", 8: "Training eff. {}%", 15: "Race {}%", 16: "Fans {}%",
    19: "Specialty {}", 25: "Event recovery {}%", 26: "Event eff. {}%", 27: "Fail protection {}%",
    28: "Energy cost -{}%", 29: "Minigame {}%", 31: "Wit recovery {}", 33: "Hint qty +{}", 41: "All stats +{}",
    **{k: f"Max {v} +{{}}" for k, v in MAX_STAT.items()},
}
# Names used in unique effects ("Training eff. +10 at bond 80")
UNI_NAME = {
    1: "Friendship", 2: "Mood", 8: "Training eff.", 15: "Race", 16: "Fans", 17: "Hint Lv", 18: "Hint freq.",
    19: "Specialty", 14: "Start bond", 25: "Event recovery", 26: "Event eff.", 27: "Fail protection",
    29: "Minigame", 30: "SP", 31: "Wit recovery", 32: "Start SP", 41: "All stats",
    **{k: v for k, v in zip(STAT_LONG, STAT_SHORT.values())},
    **{k: f"Start {v}" for k, v in INITIAL.items()},
    **{k: f"Max {v}" for k, v in MAX_STAT.items()},
}
SKILL_KIND = {1: "Speed", 2: "Accel", 3: "Recovery"}


PERCENT = {1, 2, 8, 15, 16, 18, 25, 26, 27, 29}


def gain(effect_id, value):
    if effect_id == 28:
        return f"Energy cost -{value}%"
    name = UNI_NAME.get(effect_id)
    return f"{name} +{value}{'%' if effect_id in PERCENT else ''}" if name else None


def and_join(items):
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " & " + items[-1]


def max_level(effects):
    """{effect id: value at the highest level} from GameTora's per-level rows (-1 = unchanged)."""
    out = {}
    for row in effects or []:
        vals = [v for v in row[1:] if v != -1]
        if vals and vals[-1]:
            out[row[0]] = vals[-1]
    return out


def effects_text(card):
    e = max_level(card.get("effects"))
    parts = []
    for key in EFFECT_ORDER:
        if key == "hint":
            lv, freq = e.get(17), e.get(18)
            if lv and freq:
                parts.append(f"Hint Lv{lv} / {freq}%")
            elif lv:
                parts.append(f"Hint Lv{lv}")
            elif freq:
                parts.append(f"Hint {freq}%")
        elif key in e:
            parts.append(EFFECT_LABEL[key].format(e[key]))
    return " · ".join(parts)


def start_text(card):
    e = max_level(card.get("effects"))
    parts = [f"Bond {e[14]}"] if 14 in e else []
    parts += [f"{v} +{e[k]}" for k, v in INITIAL.items() if k in e]
    if 32 in e:
        parts.append(f"SP +{e[32]}")
    return "Start: " + " · ".join(parts) if parts else ""


def bonus_rows(card):
    """Stat and skill point bonus at max level, including what the unique effect can add."""
    e = max_level(card.get("effects"))
    total = {k: e.get(k, 0) for k in [*STAT_LONG, 30]}

    def add(k, v):
        if k == 41 and v:
            for s in STAT_LONG:
                total[s] += v
        elif k in total and v:
            total[k] += v

    for eff in (card.get("unique") or {}).get("effects") or []:
        t = eff.get("type")
        if t == 101:
            for i in (1, 3):
                add(eff.get(f"value_{i}"), eff.get(f"value_{i + 1}"))
        elif t == 116:                      # +x per skill of a kind, up to n skills
            add(eff.get("value_1"), (eff.get("value_2") or 0) * (eff.get("value_3") or 0))
        elif t < 100:
            add(t, eff.get("value"))
    rows = [[v, f"+{total[k]}"] for k, v in STAT_LONG.items() if total[k]]
    if total[30]:
        rows.append(["SP", f"+{total[30]}"])
    return rows


def unique_text(card):
    """The unique effect in a few words. Rare special effects are pointed to GameTora."""
    effects = (card.get("unique") or {}).get("effects") or []
    by_bond, out = {}, []
    for eff in effects:
        t, v = eff.get("type"), eff.get("value")
        v1, v2, v3, v4 = (eff.get(f"value_{i}") for i in (1, 2, 3, 4))
        if t == 101:                          # extra effects once the bond gauge reaches v
            pairs = sorted([(v1, v2), (v3, v4)], key=lambda p: 0 if p[0] in (41, *STAT_LONG) else 1)
            by_bond.setdefault(v, []).extend(g for k, x in pairs if x and (g := gain(k, x)))
        elif t < 100 and gain(t, v):
            out.append(gain(t, v))
        elif t == 113 and gain(v, v1):
            out.append(f"{gain(v, v1)} on friendship training")
        elif t == 116 and gain(v1, v2):
            out.append(f"{gain(v1, v2)} per {SKILL_KIND.get(v, 'matching')} skill (max +{v2 * v3})")
        elif t == 103 and gain(8, v1):
            out.append(f"{gain(8, v1)} with {v}+ card types")
        elif t == 105:
            out.append(f"Initial stats +{v} per same-type card in deck")
        elif t == 109 and UNI_NAME.get(v):
            out.append(f"{UNI_NAME[v]} +1% per {v1} total bond")
        elif t == 114 and UNI_NAME.get(v):
            out.append(f"{UNI_NAME[v]} {v1}% to {v2}% scaling with energy")
        elif t == 117 and UNI_NAME.get(v):
            out.append(f"{UNI_NAME[v]} scales with facility level (max +{v2})")
        else:
            out.append("Special effect (see GameTora)")
    for bond, gains in by_bond.items():
        if gains:
            out.insert(0, f"{and_join(gains)} {'at max bond' if bond == 100 else f'at bond {bond}'}")
    return " · ".join(dict.fromkeys(out))


# ---------- skills ----------

def num(v, places=2):
    return f"{v:.{places}f}"


def secs(base_time):
    s = base_time / 10000
    return f"{s:g}s"


def effect_part(e):
    t, v = e.get("type"), e.get("value", 0)
    if t == 27:
        return f"TS +{num(v / 10000)}"
    if t == 31:
        return f"Acc +{num(v / 10000)}"
    if t == 22:
        return f"CS +{num(v / 10000)}"
    if t == 9:
        return f"Rec {'+' if v >= 0 else '−'}{abs(v) / 100:.1f}%"
    if t == 21:
        return f"Opp. speed −{num(abs(v) / 10000)}"
    if t == 28:
        return f"Lane +{num(v / 10000)}"
    if t == 8:
        return f"Vision +{v / 10000:g} m"
    if t in STAT_SHORT:
        return f"{STAT_SHORT[t]} +{v / 10000:g}"
    return None


STYLE = {1: "Front", 2: "Pace", 3: "Late", 4: "End"}
DIST = {1: "Sprint", 2: "Mile", 3: "Medium", 4: "Long"}
PHASE = {0: "Early-race", 1: "Mid-race", 2: "Late-race", 3: "Last spurt"}
WEATHER = {1: "Sunny", 2: "Cloudy", 3: "Rainy", 4: "Snowy"}
GROUND_COND = {1: "Firm", 2: "Good", 3: "Soft", 4: "Heavy"}
# display order of the condition categories
CATS = ["style", "dist", "ground", "phase", "left", "where", "final", "slope", "pos", "misc"]


def term(t):
    """One condition term → (category, label), or None to leave it out."""
    for op in ("==", "!=", ">=", "<=", ">", "<"):
        if op in t:
            key, val = t.split(op, 1)
            break
    else:
        return None
    try:
        n = int(val)
    except ValueError:
        return None

    if key == "running_style" and op == "==":
        return "style", STYLE.get(n)
    if key == "distance_type" and op == "==":
        return "dist", DIST.get(n)
    if key == "ground_type" and op == "==":
        return "ground", {1: "Turf", 2: "Dirt"}.get(n)
    if key in ("phase", "phase_random") and op == "==":
        return "phase", PHASE.get(n)
    if key == "phase" and op in (">=", ">"):
        n = n + (op == ">")
        return "phase", {1: "Mid-race+", 2: "Late-race+", 3: "Last spurt"}.get(n)
    if key == "phase" and op in ("<=", "<"):
        n = n - (op == "<")
        return "phase", {0: "Early-race", 1: "Before late-race", 2: "Before last spurt"}.get(n)
    if key in ("phase_firsthalf_random", "phase_firsthalf") and op == "==":
        return "phase", "Early " + PHASE.get(n, "").lower() if n in PHASE else None
    if key in ("phase_laterhalf_random", "phase_laterhalf") and op == "==":
        return "phase", "Late " + PHASE.get(n, "").lower() if n in PHASE else None
    if key in ("phase_firstquarter_random", "phase_firstquarter") and op == "==":
        return "phase", "Start of " + PHASE.get(n, "").lower() if n in PHASE else None
    if key in ("is_lastspurt", "lastspurt") and n == 1 and op == "==":
        return "phase", "Last spurt"
    if key == "remain_distance":
        return "left", f"{n}+ m left" if op in (">=", ">") else f"≤{n} m left"
    if key == "distance_rate":
        return "left", f"After {n}%" if op in (">=", ">") else f"Before {n}%"
    if key in ("corner", "all_corner_random", "corner_random", "phase_corner_random"):
        if key == "corner" and op == "==" and n == 0:
            return "where", "Straight"
        return "where", "Corner"
    if key in ("straight_random", "phase_straight_random"):
        return "where", "Straight"
    if key in ("is_finalcorner", "is_finalcorner_random") and n == 1:
        return "final", "Final corner"
    if key == "is_finalcorner_laterhalf" and n == 1:
        return "final", "Final corner"
    if key in ("is_last_straight", "is_last_straight_onetime") and n == 1:
        return "final", "Final straight"
    if key == "slope" and op == "==":
        return "slope", {1: "Uphill", 2: "Downhill"}.get(n)
    if key == "up_slope_random":
        return "slope", "Uphill"
    if key == "down_slope_random":
        return "slope", "Downhill"
    if key == "order_rate":
        return "pos", f"Top {n}%" if op in ("<=", "<") else f"Back {100 - n}%"
    if key == "order":
        if op == "==":
            return "pos", {1: "1st"}.get(n, f"Pos {n}")
        return "pos", f"Top {n}" if op in ("<=", "<") else f"Pos {n}+"
    if key in ("is_overtake", "overtake_target_time"):
        return "misc", "Overtaking"
    if key.startswith("blocked_"):
        return "misc", "Blocked"
    if key == "is_surrounded":
        return "misc", "Surrounded"
    if key == "weather" and op == "==":
        return "misc", WEATHER.get(n)
    if key == "ground_condition" and op == "==":
        return "misc", GROUND_COND.get(n)
    if key == "hp_per":
        return "misc", f"HP ≤{n}%" if op in ("<=", "<") else f"HP {n}%+"
    return None


def conditions_text(condition):
    """"running_style==2&phase>=2@running_style==3&phase>=2" → "Pace / Late · Late-race+"."""
    by_cat = {c: [] for c in CATS}
    for alt in (condition or "").split("@"):
        terms = [t.strip() for t in alt.split("&")]
        # order_rate>=30 & order_rate<=80 → "30–80% of the pack" rather than two labels
        lo = [int(t.split(">", 1)[1].lstrip("=")) for t in terms if t.startswith("order_rate>")]
        hi = [int(t.split("<", 1)[1].lstrip("=")) for t in terms if t.startswith("order_rate<")]
        labels = []
        if lo and hi:
            labels.append(("pos", f"{lo[0]}–{hi[0]}% of the pack"))
            terms = [t for t in terms if not t.startswith("order_rate")]
        labels += [term(t) for t in terms]
        for r in labels:
            if r and r[1] and r[1] not in by_cat[r[0]]:
                by_cat[r[0]].append(r[1])
    return " · ".join(" / ".join(v) for c in CATS if (v := by_cat[c]))


def skill_name(skill):
    return skill.get("name_en") or skill.get("enname") or skill.get("jpname") or str(skill.get("id"))


def skill_detail(skill):
    """("TS +0.35 · 2.4s", "Corner") from the first condition group."""
    groups = skill.get("condition_groups") or []
    if not groups:
        return "", ""
    g = groups[0]
    parts = [p for p in (effect_part(e) for e in g.get("effects", [])) if p]
    if parts and (g.get("base_time") or 0) > 0:
        parts.append(secs(g["base_time"]))
    return " · ".join(parts), conditions_text(g.get("condition"))


def skill_line(skill, kind="gold"):
    """kind: "gold" (gold name), "plain" (bold name), "evo" (evolved: name, then effect below)."""
    name = skill_name(skill)
    eff, cond = skill_detail(skill)
    small = f"<br /><small>{cond}</small>" if cond else ""
    if kind == "evo":
        return f'<b><span class="evo">{name}</span></b>' + (f"<br />{eff}" if eff else "") + small
    head = f'<span class="gold">{name}</span>' if kind == "gold" else name
    return f"<b>{head}</b>" + (f" – {eff}" if eff else "") + small


def support_keyskills(card, skills):
    """Gold skills of the card in full, then its other (white) skills on one line."""
    ids = list(dict.fromkeys((card.get("hints") or {}).get("hint_skills", []) + (card.get("event_skills") or [])))
    found = [skills[i] for i in ids if i in skills]
    gold = [{"html": skill_line(s, "gold")} for s in found if s.get("rarity") == 2]
    white = [skill_name(s) for s in found if s.get("rarity") == 1 and "dbf" not in (s.get("type") or [])]
    return gold + ([{"html": " · ".join(white)}] if white else [])


def uma_keyskills(card, skills):
    """Unique skill, gold skills (with their evolved versions), then other awakening skills on one line."""
    out = []
    for i in card.get("skills_unique") or []:
        if i in skills:
            out.append({"html": skill_line(skills[i], "plain")})
    evo = {}
    for e in card.get("skills_evo") or []:
        evo.setdefault(e["old"], []).append(e["new"])
    white = []
    for i in card.get("skills_awakening") or []:
        s = skills.get(i)
        if not s:
            continue
        if s.get("rarity") == 2:
            entry = {"html": skill_line(s, "gold")}
            subs = [skill_line(skills[n], "evo") for n in evo.get(i, []) if n in skills]
            if subs:
                entry["sub"] = subs
            out.append(entry)
        else:
            white.append(skill_name(s))
    if white:
        out.append({"html": " · ".join(white)})
    return out
