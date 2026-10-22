# Umapastèque

Umamusume support card planner: a release timeline per running style, with filters by card type and verdict.

## Structure

| Path | Role |
|---|---|
| `index.html` | The site (HTML, CSS and JS in one file). Reads its data from `data/`. |
| `data/end.json` | End Closer support cards: one object per card (name, type, release date, ratings, verdict, bonuses…). |
| `.github/workflows/pages.yml` | Deploys the site to GitHub Pages on every push to `main`. |

## Run locally

`fetch()` does not work from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Roadmap

1. Static site on GitHub Pages (this step).
2. Mobile layout: vertical timeline, fixed filter header.
3. Notion sync: a scheduled GitHub Action exports the Notion databases to `data/*.json` and redeploys.
