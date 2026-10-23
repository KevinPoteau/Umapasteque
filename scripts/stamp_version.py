#!/usr/bin/env python3
"""Add ?v=<version> to the site's CSS, JS and data URLs (deploy step only).

GitHub Pages lets browsers cache files for 10 minutes, so right after a deploy a
browser can mix a new index.html with old JS modules. Giving every deploy fresh
URLs avoids that. Run on the deployed copy, never committed.

Usage:  python3 scripts/stamp_version.py <version>
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
v = sys.argv[1]

def stamp(path, rules):
    text = path.read_text(encoding="utf-8")
    for pattern, repl in rules:
        text = re.sub(pattern, repl, text)
    path.write_text(text, encoding="utf-8")

# <link href="css/x.css"> and <script src="js/x.js">
stamp(ROOT / "index.html", [(r'((?:href|src)="(?:css|js)/[\w-]+\.(?:css|js))"', rf'\1?v={v}"')])

for js in (ROOT / "js").glob("*.js"):
    stamp(js, [
        (r'(from "\./[\w-]+\.js)"', rf'\1?v={v}"'),             # import … from "./x.js"
        (r'("data/[\w/-]+\.json)"', rf'\1?v={v}"'),             # "data/scenarios.json"
        (r'(`data/[^`]+\.json)`', rf'\1?v={v}`'),               # `data/${kind}/${role}.json`
    ])

print(f"stamped with v={v}")
