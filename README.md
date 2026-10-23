# Umapastèque

Umamusume support card planner: a release timeline per running style, with filters by card type and verdict.

Live site: https://kevinpoteau.github.io/Umapasteque/

## Layout

```
index.html              page markup only
admin.html              admin page: rate entries, publish as a pull request
css/
  base.css              colour tokens, header, filter bar
  timeline.css          horizontal timeline, date ruler, needle reader
  card.css              support card (v1 Notion callout layout)
  admin.css             admin page
js/                     ES modules, no build step
  main.js               entry point: loads data, wires everything
  config.js             roles, card types, verdicts, image paths
  state.js              filter state (remembered in the browser)
  filters.js            search, type chips, verdict scale
  timeline.js           scenario sections, Today marker, scrolling
  ruler.js              date ruler + scenario art under the needle
  card.js               card markup
  util.js               helpers, image fallback (local copy → original URL)
  admin.js              admin page: entry list, rating form, live preview
  github.js             GitHub API calls used by the admin page
data/
  scenarios.json        scenario names, start dates, colours, art source
  support.json          support cards, one entry per card, rated per running style
  uma.json              Umas, same idea
assets/
  icons/types/          card type icons (SVG)
  icons/verdicts/       verdict arrows
  icons/roles/          running style badges      ┐ downloaded by
  cards/<id>.webp       card art (id = game id)    │ scripts/fetch_assets.py
  umas/<id>.webp        Uma art (id = outfit id)   │
  scenarios/            scenario art               ┘
scripts/fetch_assets.py downloads missing images into assets/
scripts/validate_data.py checks data/ (runs on every pull request and deploy)
scripts/import_new.py   adds newly announced SSR cards and Umas to rate (source: GameTora)
.github/workflows/
  pages.yml             deploys to GitHub Pages on push to main
  fetch-assets.yml      downloads new images when data changes and opens a PR with them
  import.yml            every Monday: new cards and Umas to rate → one PR
  validate.yml          checks data/ on every pull request
```

Images not yet in `assets/` are loaded from their original site, so the page works before and after the sync.

## Rating entries (admin page)

Open `admin.html` on the site (e.g. https://kevinpoteau.github.io/Umapasteque/admin.html).

1. **GitHub token** (once per browser): create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with *Repository access → Only select repositories → Umapasteque*, permissions *Contents: Read and write* and *Pull requests: Read and write*, and an expiry date. Paste it in the dialog. It stays in that browser only.
2. Pick Support cards / Umas, and optionally a running style. **To rate** lists entries with no running style yet, a style without a verdict, or `"todo": true`; **Changed** lists what you edited in this session.
3. Add the running styles the entry is good for (**+ Pace Chaser**…), then rate each one: verdict, stars, text. Dates are shared. The preview shows the card as it will look. Changes are kept in the browser until published.
4. **Publish** opens one pull request with every change. The *Check data* run on it must be green; merge it and the site redeploys.

## New cards and Umas (weekly import)

Every Monday, *Import new cards and Umas* looks at [GameTora](https://gametora.com)'s data for SSR support cards and Umas whose global release (real, or GameTora's prediction) is within the next ~14 months and not in `data/` yet. It adds them with `"todo": true` and no running style, and opens (or updates) one pull request listing them. It can also be run by hand from the Actions tab.

After merging, they appear in the admin page's **To rate** list, but not on the site: an entry only shows once a running style is added to it. **Don't track** removes an entry and records its id in `data/ignored.json`, so the import never adds it again.

The import never changes an existing entry; if GameTora has a confirmed global date that differs from ours, the pull request only mentions it.

## How to edit

| I want to… | Edit |
|---|---|
| Rate, or show an entry on another running style | the admin page (above), or `roles` in the data file |
| Add or change a card | `data/support.json`: one object per card. `id` is the game's card id (it names the image), `iso` is the release date, `color` the card background (`blue`, `red`, `orange`, `pink`, `green`, `yellow`, `purple`). `roles` lists the running styles the card is shown on, each with its own rating: `{"pace": {"rank": 4, "verdict": ["…"], "stats": 3, "skills": 4, "longevity": "…", "bonus": [["Speed", "+1"]]}}` (`rank`: 5 = Highly recommended … 1 = Very bad). A style missing from `roles` never shows the card. |
| Add or change an Uma | `data/uma.json`: same idea, with `runner` / `inherit` / `evolved` stars, `aptitudes`, `outfit` and `style` (her own running style); each role holds `rank` and `verdict` |
| Check my edits by hand | `python3 scripts/validate_data.py` |
| Change a scenario date or colour | `data/scenarios.json` |
| Change a colour or the card width | the `:root` block at the top of `css/base.css` (every token is commented) |
| Rename a verdict or swap its icon | `VERDICTS` in `js/config.js` + `assets/icons/verdicts/` |
| Change the card layout | markup in `js/card.js`, styles in `css/card.css` |
| Change the filters | `js/filters.js` (buttons), `js/state.js` (what "matches" means) |

After a push to `main` (through a pull request), the site redeploys on its own in about a minute.

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
