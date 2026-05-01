# Production smoke — 2026-04-30

Closes T183 / T245. Captures the result of the production smoke after the
first deploy.

## Status

`PENDING` — must be exercised after first prod deploy.

## Tests

* `/healthz` returns 200 within the 5-min startup grace.
* The next scheduled `scrape.news` runs within 30 min of deploy and writes
  `ScraperRun` rows for all 5 sources.
* An induced 5-failure outlet (toggle a fake source's URL to a 502
  endpoint, wait 5 cron cycles) trips the editor Slack alert within 15
  min and disables the source via `Source.enabled = false`.

## Evidence

| Test | Result | Notes |
|------|--------|-------|
| `/healthz` ≤200 within startup grace | _PASS / FAIL_ | |
| `scrape.news` cron within 30 min | _PASS / FAIL_ | |
| 5-failure outlet auto-disable + Slack alert | _PASS / FAIL_ | |
| Operator | _to be recorded_ | |
