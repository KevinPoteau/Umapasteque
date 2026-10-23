#!/usr/bin/env python3
"""Download the images the site still loads from other sites into assets/.

The page tries assets/... first and falls back to the original URL, so this
script only makes the site self-contained; it never changes data/.

Usage:  python3 scripts/fetch_assets.py [--force]
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (Umapasteque asset sync; +https://github.com/KevinPoteau/Umapasteque)"
FORCE = "--force" in sys.argv


def ext_of(url: str) -> str:
    m = re.search(r"\.(png|jpe?g|webp|gif)(?:$|[?&])", url, re.I)
    return "." + m.group(1).lower() if m else ".png"


def targets():
    """(destination, url) pairs. Paths must match js/config.js."""
    for f in sorted((ROOT / "data" / "support").glob("*.json")):
        for card in json.loads(f.read_text(encoding="utf-8")):
            if card.get("id") and card.get("imgSource"):
                yield ROOT / "assets" / "cards" / f"{card['id']}.webp", card["imgSource"]
    for f in sorted((ROOT / "data" / "uma").glob("*.json")):
        for uma in json.loads(f.read_text(encoding="utf-8")):
            if uma.get("id") and uma.get("imgSource"):
                yield ROOT / "assets" / "umas" / f"{uma['id']}.webp", uma["imgSource"]
    for sc in json.loads((ROOT / "data" / "scenarios.json").read_text(encoding="utf-8")):
        yield ROOT / "assets" / "scenarios" / f"{sc['slug']}{ext_of(sc['imgSource'])}", sc["imgSource"]
    for role in ("front", "pace", "late", "end"):
        yield ROOT / "assets" / "icons" / "roles" / f"{role}.webp", f"https://uma.guide/img/banner-reviews/badges/playstyle-{role}.webp"
    yield (ROOT / "assets" / "icons" / "shoes.png",
           "https://s3-us-west-2.amazonaws.com/public.notion-static.com/e2557030-cdaa-41e2-9521-eab8e5b5e50a/uma_aptitude_shoes.png")
    yield (ROOT / "assets" / "icons" / "sp.png",
           "https://s3-us-west-2.amazonaws.com/public.notion-static.com/01249879-d648-48a2-b3c8-b368ffff1156/uma_sp_star.png")


def main() -> int:
    seen, got, skipped, failed = set(), 0, 0, []
    for dest, url in targets():
        if dest in seen:
            continue
        seen.add(dest)
        if dest.exists() and not FORCE:
            skipped += 1
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
            if not body or b"<html" in body[:200].lower():
                raise ValueError("not an image")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(body)
            got += 1
            print(f"ok    {dest.relative_to(ROOT)}")
            time.sleep(0.3)  # be gentle with the source sites
        except Exception as e:  # keep going; the site falls back to the original URL
            failed.append(f"{dest.relative_to(ROOT)} <- {url} ({e})")
    print(f"\n{got} downloaded, {skipped} already present, {len(failed)} failed")
    for line in failed:
        print("FAIL ", line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
