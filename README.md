# Umapastèque

Umamusume support card planner: a release timeline per running style, with filters by card type and verdict.

Live site: https://kevinpoteau.github.io/Umapasteque/

## Layout

```
index.html              page markup only
css/
  base.css              colour tokens, header, filter bar
  timeline.css          horizontal timeline, date ruler, needle reader
  card.css              support card (v1 Notion callout layout)
js/                     ES modules, no build step
  main.js               entry point: loads data, wires everything
  config.js             roles, card types, verdicts, image paths
  state.js              filter state (remembered in the browser)
  filters.js            search, type chips, verdict scale
  timeline.js           scenario sections, Today marker, scrolling
  ruler.js              date ruler + scenario art under the needle
  card.js               card markup
  util.js               helpers, image fallback (local copy → original URL)
data/
  scenarios.json        scenario names, start dates, colours, art source
  support/end.json      End Closer support cards
assets/
  icons/types/          card type icons (SVG)
  icons/verdicts/       verdict arrows
  icons/roles/          running style badges      ┐ downloaded by
  cards/<id>.webp       card art (id = game id)    │ scripts/fetch_assets.py
  scenarios/            scenario art               ┘
scripts/fetch_assets.py downloads missing images into assets/
.github/workflows/
  pages.yml             deploys to GitHub Pages on push to main
  fetch-assets.yml      downloads new images when data changes and opens a PR with them
```

Images not yet in `assets/` are loaded from their original site, so the page works before and after the sync.

## Run locally

ES modules and `fetch()` do not work from `file://`, so serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
python3 scripts/fetch_assets.py   # optional: store images locally
```

## Roadmap

1. ~~Static site on GitHub Pages~~
2. Mobile layout: vertical timeline, fixed filter header
3. Notion sync: a scheduled GitHub Action exports the Notion databases to `data/` and redeploys
4. Front / Pace / Late pages
