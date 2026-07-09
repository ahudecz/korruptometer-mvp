-- 0037 — ScandalCatalog: determinisztikus + cikk-súlyozott person/institution/summary,
-- plusz egyedi index
--
-- Két hiba a 0030-as materializált nézetben:
-- 1. person/institution/summary 3 FÜGGETLEN korrelált al-lekérdezésből jött, mindegyik
--    a scandalKey EGYETLEN legtöbb-cikkes Investigation-jét választva
--    ("ORDER BY articleCount DESC NULLS LAST LIMIT 1"), másodlagos rendezés nélkül.
--    Ez két problémát okozott:
--      a) holtverseny esetén Postgres nem determinisztikusan döntött, és a 3 mező
--         akár KÜLÖNBÖZŐ "nyertes" Investigation-ből is származhatott;
--      b) egyetlen fragmentum cikkszáma alapján döntött, nem az adott személyhez
--         tartozó ÖSSZES fragmentum együttes súlya alapján — pl. mnb-botrany: 10
--         Matolcsy-fragmentum állt szemben 2 Mészáros-fragmentummal, mégis egy
--         Mészáros-fragmentum "nyert", mert annak volt a legtöbb cikke EGYEDÜL.
--    Most: person/institution a scandalKey-en belül a legtöbb ÖSSZESÍTETT cikkel
--    (SUM(articleCount)) rendelkező névre esik, nem egyetlen fragmentum egyedi
--    cikkszámára — ez a "kié ez az affér ténylegesen" kérdésre ad jobb választ.
--    A summary a nyertes person LEGTÖBB CIKKES saját fragmentumából jön (koherencia
--    kedvéért), stabil id ASC tiebreak-kel holtverseny esetén.
-- 2. Nem volt EGYEDI index a nézeten, így az óránkénti Inngest cron
--    (aggregate-kpi-rollup.ts) "REFRESH MATERIALIZED VIEW CONCURRENTLY" hívása
--    mindig hibázott (ehhez egyedi index kell) — a hiba egy csendes catch{}-be
--    futott, úgyhogy a nézet gyakorlatilag SOSEM frissült automatikusan.
--
-- Futtatás: Supabase Dashboard → SQL Editor → Paste → Run
-- Várható futási idő: a REFRESH miatt hasonló mint a 0030-nál (30-60 mp)

DROP MATERIALIZED VIEW IF EXISTS "ScandalCatalog";

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
),
person_totals AS (
  SELECT "scandalKey" AS id, "primaryPersonName" AS person, sum("articleCount") AS total_articles
  FROM "Investigation"
  WHERE "scandalKey" IS NOT NULL AND status NOT IN ('merged', 'dismissed')
    AND "primaryPersonName" IS NOT NULL
  GROUP BY "scandalKey", "primaryPersonName"
),
person_winner AS (
  SELECT DISTINCT ON (id) id, person
  FROM person_totals
  ORDER BY id, total_articles DESC, person ASC
),
institution_totals AS (
  SELECT "scandalKey" AS id, "primaryEntityName" AS institution, sum("articleCount") AS total_articles
  FROM "Investigation"
  WHERE "scandalKey" IS NOT NULL AND status NOT IN ('merged', 'dismissed')
    AND "primaryEntityName" IS NOT NULL
  GROUP BY "scandalKey", "primaryEntityName"
),
institution_winner AS (
  SELECT DISTINCT ON (id) id, institution
  FROM institution_totals
  ORDER BY id, total_articles DESC, institution ASC
),
summary_winner AS (
  -- A nyertes person legtöbb-cikkes saját fragmentumának summary-ja, koherencia miatt.
  SELECT DISTINCT ON (i."scandalKey")
    i."scandalKey" AS id, i.summary AS summary
  FROM "Investigation" i
  JOIN person_winner pw ON pw.id = i."scandalKey" AND pw.person = i."primaryPersonName"
  WHERE i.status NOT IN ('merged', 'dismissed')
  ORDER BY i."scandalKey", i."articleCount" DESC NULLS LAST, i.id ASC
)
SELECT
  a.*,
  pw.person,
  iw.institution,
  sw.summary
FROM agg a
LEFT JOIN person_winner pw ON pw.id = a.id
LEFT JOIN institution_winner iw ON iw.id = a.id
LEFT JOIN summary_winner sw ON sw.id = a.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scandal_catalog_id_uq
  ON "ScandalCatalog" (id);

CREATE INDEX IF NOT EXISTS idx_scandal_catalog_damage
  ON "ScandalCatalog" (damage_huf DESC, id ASC);

-- Feltölti az adatokat
REFRESH MATERIALIZED VIEW "ScandalCatalog";
