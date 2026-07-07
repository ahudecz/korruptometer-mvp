# corruption-tracker Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-06-28

## Active Technologies

- TypeScript 5.6 on Node 20 (existing repo pin). + Next.js 15 (App Router), Inngest 3.x, Drizzle ORM 0.36, `@anthropic-ai/sdk` (Haiku 4.5), `cheerio` / `fast-xml-parser` (existing in `@korr/scrapers`), `@upstash/ratelimit` (existing, used for the admin-API floor). (002-investigation-engine)
- Make.com (external service) + `@supabase/supabase-js` — `SocialPost` table for the Facebook social feed. (002-make-facebook-social-feed)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.6 on Node 20 (existing repo pin).: Follow standard conventions

## Recent Changes

- 002-make-facebook-social-feed: Added TypeScript / Next.js 15 (App Router), Node 20 + Drizzle ORM, `@supabase/supabase-js`, Make.com (external service); `SocialPost` table extension.
- 002-investigation-engine: Added TypeScript 5.6 on Node 20 (existing repo pin). + Next.js 15 (App Router), Inngest 3.x, Drizzle ORM 0.36, `@anthropic-ai/sdk` (Haiku 4.5), `cheerio` / `fast-xml-parser` (existing in `@korr/scrapers`), `@upstash/ratelimit` (existing, used for the admin-API floor).

<!-- MANUAL ADDITIONS START -->

## Databases & environment safety

- **Live (Supabase Cloud) is the single source of truth.** All real news processing runs
  server-side via the Inngest pipeline against live. Local `npx supabase start` DBs
  (`127.0.0.1`) are **disposable sandboxes** — for schema/UI/destructive testing only. Seed
  them from `seed.ts` or a sanitized snapshot; never treat locally-created data as canonical.
- **Never merge one local DB into another.** If real data must be added out-of-band, run a
  one-off import script deliberately against live (one person at a time). Writers are
  idempotent (see below), so a re-run is harmless.
- **Idempotency is already the norm** for continuous writers: `onConflictDoNothing` on the
  natural key (e.g. `NewsArticle.sourceUrlHash`), the `isDuplicate()` helper
  (`packages/db/src/review.ts`), or an inline existence check. Preserve this when adding
  writers. Append-only tables (`AuditLog`, `ScraperRun`, `KpiSnapshot`) are intentionally
  not deduped.
- **Guard destructive/import scripts.** Any one-off script that mutates data must call
  `assertWriteTarget('<script-name>')` (`packages/db/src/guard.ts`) at the top of `main()`.
  It refuses to run against a non-local DB unless `ALLOW_PROD_WRITE=1` is set, so a stray
  prod `DATABASE_URL` in `.env` can't nuke live by accident. Already wired into the
  `delete-*` scripts; retrofit the remaining `cleanup-*` / `dedup-*` scripts the same way.

<!-- MANUAL ADDITIONS END -->
