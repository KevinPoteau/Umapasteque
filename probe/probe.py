"""Temporary: fetch GameTora files about effects and skills (probe/out/)."""
import json, urllib.request
from pathlib import Path
OUT = Path("probe/out"); OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Umapasteque data probe (github.com/KevinPoteau/Umapasteque)"}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r: return r.read()
man = json.loads(get("https://gametora.com/data/manifests/umamusume.json"))
(OUT / "manifest.json").write_bytes(json.dumps(man).encode())
for key in ["support_effects", "skills", "static/skill_conditions", "static/skill_effect_values", "static/skill_condition_values",
            "evolutions", "support-cards", "character-cards", "en/foresight/predicted_releases", "characters"]:
    try:
        (OUT / (key.replace("/", "_") + ".json")).write_bytes(get(f"https://gametora.com/data/umamusume/{key}.{man[key]}.json"))
    except Exception as e:
        (OUT / (key.replace("/", "_") + ".error")).write_text(repr(e))
# pages that render support card text, to see how GameTora words effects and skills
for name, url in [("card_30128.html", "https://gametora.com/umamusume/supports/30128-sweep-tosho"),
                  ("skills_page.html", "https://gametora.com/umamusume/skills")]:
    try: (OUT / name).write_bytes(get(url))
    except Exception as e: (OUT / (name + ".error")).write_text(repr(e))
