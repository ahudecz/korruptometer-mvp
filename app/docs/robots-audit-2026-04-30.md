# Robots.txt audit — 2026-04-30

Closes T243. Verifies that the feed paths used by `app/packages/scrapers/src/*`
are not `Disallow`-listed by each outlet's `/robots.txt` for the
`Korruptometer-Bot/1.0` user-agent.

## Method

```sh
curl -sLA 'Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)' \
     --max-time 8 https://<host>/robots.txt
```

Per FR-061 we identify as `Korruptometer-Bot/1.0`, throttle to ≤ 1 req / 2
sec per outlet, and re-fetch each robots.txt daily. The relevant `User-agent: *`
directives below are what apply to us by default (no outlet has a specific
rule for our UA).

## Results — 2026-04-30

| Outlet | Adapter feed path | robots.txt verdict |
|--------|-------------------|--------------------|
| telex.hu | `/rss/archivum` | ✓ allowed — only `facebookexternalhit` rule, no `User-agent: *` block |
| 444.hu | `/feed` | ✓ allowed — disallows `/admin`, `/szerk`, `/stream`, `/post` only |
| hvg.hu | `/rss/itthon` | ✓ allowed — disallows `/OAuth.ashx/*`, `/rangsor/*`, `/segedanyagok/*`, `/segedanyagtalalatok/*` only |
| hang.hu | `/feed` | ✓ allowed — disallows `/admin/`, `/kereses`; Crawl-delay 1s (we already do ≥1 req/2s) |
| atlatszo.hu | `/feed/` | ✓ allowed — disallows `/wp-admin/`, `/wp-content/uploads/wc-logs/`, `/?s=`, `/page/*/?s=`, `/search/` only |

## Findings

* No re-routing required.
* hang.hu's `Crawl-delay: 1` is comfortably exceeded by the ≥ 1 req / 2 sec
  cap in `app/packages/scrapers/src/http.ts`.
* The shared HTTP wrapper re-fetches robots.txt at most once per outlet per
  24 h (FR-061).

## Recurrence

Re-run on every Phase-3 deploy and at least monthly thereafter. Document
each run in this folder by date.
