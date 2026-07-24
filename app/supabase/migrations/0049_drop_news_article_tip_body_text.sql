-- Revert 0048: NewsArticle.tipBodyText persisted full/near-full article body,
-- violating constitution Article IV (Data Minimization) — "NewsArticle.body
-- is not stored. Only headline, excerpt (<=280 chars)... are persisted.
-- Adding a body column requires a constitution amendment." Body text needed
-- for detection is now fetched TRANSIENTLY at point of use and discarded,
-- never written to a column (matches packages/scrapers/src/full-text-fetch.ts's
-- existing, constitution-compliant pattern).
ALTER TABLE "NewsArticle" DROP COLUMN IF EXISTS "tipBodyText";
