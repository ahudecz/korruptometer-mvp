-- 002-investigation-engine — K-Monitor ↔ scraping dedup link.
--
-- The kmdb corpus (KMonitorArticle) and own scraping (NewsArticle) both ingest
-- the same outlets, so a recent article can exist in both. There was no shared
-- identity to detect the overlap. Add a canonical-URL hash (same canonicalUrl()
-- /dedupHash() the scraper uses) and a back-link to the matching NewsArticle.
-- The engine then treats one canonical article once: kmdb rows with a match are
-- enrichment for the scraped NewsArticle, not a separate extraction input.
--
-- Guarded with IF EXISTS / IF NOT EXISTS: the K-Monitor tables are not
-- provisioned in every environment, so this is a safe no-op where absent.
-- Additive, read-only to existing data (Principle VII).

ALTER TABLE IF EXISTS "KMonitorArticle"
  ADD COLUMN IF NOT EXISTS "canonicalUrl"        text,
  ADD COLUMN IF NOT EXISTS "urlHash"             text,
  ADD COLUMN IF NOT EXISTS "matchedNewsArticleId" uuid;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'KMonitorArticle') THEN
    -- FK to NewsArticle (set null on delete); add only if not already present.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'KMonitorArticle'
        AND constraint_name = 'KMonitorArticle_matchedNewsArticleId_fkey'
    ) THEN
      ALTER TABLE "KMonitorArticle"
        ADD CONSTRAINT "KMonitorArticle_matchedNewsArticleId_fkey"
        FOREIGN KEY ("matchedNewsArticleId") REFERENCES "NewsArticle"(id) ON DELETE SET NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS "KMonitorArticle_urlHash_idx" ON "KMonitorArticle" ("urlHash");
    CREATE INDEX IF NOT EXISTS "KMonitorArticle_matched_idx" ON "KMonitorArticle" ("matchedNewsArticleId");
  END IF;
END $$;
