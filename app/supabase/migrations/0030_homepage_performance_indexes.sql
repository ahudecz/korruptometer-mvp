-- 0030 — Főoldal lekérdezések gyorsítása
--
-- 1. pg_trgm GIN index: ILIKE '%...%' lekérdezések 1000x gyorsabbak
-- 2. ScandalCatalog: VIEW → MATERIALIZED VIEW → azonnali olvasás
--
-- Futtatás: Supabase Dashboard → SQL Editor → Paste → Run
-- Várható futási idő: 30-60 másodperc

-- ── 1. Trigram extension + headline index ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_news_article_headline_trgm
  ON "NewsArticle" USING gin(headline gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_news_article_tag
  ON "NewsArticle" (tag)
  WHERE tag IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_news_article_published_at
  ON "NewsArticle" ("publishedAt" DESC);

-- ── 2. ScandalCatalog VIEW → MATERIALIZED VIEW ───────────────────────────────
DROP VIEW IF EXISTS "ScandalCatalog";

CREATE MATERIALIZED VIEW "ScandalCatalog" AS
WITH agg AS (
  SELECT
    i."scandalKey"                                   AS id,
    max(i."scandalName")                             AS name,
    count(*)::int                                    AS investigation_count,
    coalesce(sum(i."articleCount"), 0)::int          AS article_count,
    coalesce(max(d."totalHighHuf"), 0)               AS damage_huf,
    bool_or(
      i."proceduralStage" IS NULL
      OR i."proceduralStage" NOT IN ('final_verdict', 'closed_no_charge', 'acquitted')
    )                                                AS is_open,
    max(i."createdAt")                               AS created_at,
    (
      SELECT array_agg(DISTINCT code)
      FROM (
        SELECT unnest(i2."offenceTypes") AS code
        FROM "Investigation" i2
        WHERE i2."scandalKey" = i."scandalKey"
          AND i2.status NOT IN ('merged', 'dismissed')
      ) codes
    )                                                AS offence_codes
  FROM "Investigation" i
  LEFT JOIN "DamageEstimate" d ON d."investigationId" = i.id
  WHERE i."scandalKey" IS NOT NULL
    AND i.status NOT IN ('merged', 'dismissed')
  GROUP BY i."scandalKey"
)
SELECT
  a.*,
  (
    SELECT i3."primaryPersonName" FROM "Investigation" i3
    WHERE i3."scandalKey" = a.id AND i3.status NOT IN ('merged', 'dismissed')
    ORDER BY i3."articleCount" DESC NULLS LAST LIMIT 1
  ) AS person,
  (
    SELECT i3."primaryEntityName" FROM "Investigation" i3
    WHERE i3."scandalKey" = a.id AND i3.status NOT IN ('merged', 'dismissed')
    ORDER BY i3."articleCount" DESC NULLS LAST LIMIT 1
  ) AS institution,
  (
    SELECT i3.summary FROM "Investigation" i3
    WHERE i3."scandalKey" = a.id AND i3.status NOT IN ('merged', 'dismissed')
    ORDER BY i3."articleCount" DESC NULLS LAST LIMIT 1
  ) AS summary
FROM agg a;

CREATE INDEX IF NOT EXISTS idx_scandal_catalog_damage
  ON "ScandalCatalog" (damage_huf DESC, id ASC);

-- Feltölti az adatokat
REFRESH MATERIALIZED VIEW "ScandalCatalog";
