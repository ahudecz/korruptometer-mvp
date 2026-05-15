# Outlet RSS fixtures

These XML files are real captures of each outlet's RSS feed taken on
2026-05-01:

| Slug         | Source                          |
| ------------ | ------------------------------- |
| telex        | https://telex.hu/rss/archivum   |
| 444          | https://444.hu/feed             |
| hvg          | https://hvg.hu/rss/itthon       |
| magyar-hang  | https://hang.hu/feed            |
| atlatszo     | https://atlatszo.hu/feed/       |

The adapter tests in `src/adapters.test.ts` parse these fixtures via
`parseRss()` and assert that each item produces a well-formed
`ScrapedArticle` (non-empty headline, ≤280-char excerpt, absolute URL,
parseable publishedAt). To refresh the fixtures, re-run the curl commands
in `app/scripts/fetch-rss-fixtures.sh` (placeholder — add when the real
adapter selectors next drift) or simply:

```sh
curl -A "Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)" \
     -o packages/scrapers/__fixtures__/<slug>.xml \
     <feed-url>
```

## Why RSS instead of HTML scraping

- 444.hu's website is an Ember.js SPA; an HTTP GET on `/legfrissebb`
  returns a near-empty shell with no article cards. The RSS feed is the
  only practical source.
- HTML selectors drift every time an outlet ships a redesign. RSS items
  carry stable `<title>`, `<link>`, `<pubDate>`, `<description>` fields
  that haven't changed in 20 years.
- All five spec-mandated outlets publish RSS (verified 2026-05-01).

## K-Monitor discovery fixtures

`kmonitor/` holds HTML captures of `adatbazis.k-monitor.hu` (2026-05-10),
used by `src/kmonitor-discovery.test.ts`:

| File                              | Source                                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| `hirek-index.html`                | `https://adatbazis.k-monitor.hu/hirek` (301-target of `/cimkek/`)   |
| `tag-nav-vizsgalat.html`          | `https://adatbazis.k-monitor.hu/adatbazis/cimkek/nav-vizsgalat`     |
| `tag-lounge-design-kft.html`      | `https://adatbazis.k-monitor.hu/adatbazis/cimkek/lounge-design-kft` |
| `tag-fidesz.html`                 | `https://adatbazis.k-monitor.hu/adatbazis/cimkek/fidesz`            |

K-Monitor's `robots.txt` blocks `ClaudeBot`/`GPTBot` outright; refresh
these fixtures only with a non-bot UA. The fetch command pattern:

```sh
curl -L -A "Korruptometer-Bot/1.0 (+https://korruptometer.hu/scraper)" \
     -o packages/scrapers/__fixtures__/kmonitor/tag-<slug>.html \
     "https://adatbazis.k-monitor.hu/adatbazis/cimkek/<slug>"
```
