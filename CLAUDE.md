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
<!-- MANUAL ADDITIONS END -->
