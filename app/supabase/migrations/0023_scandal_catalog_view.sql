-- 002-investigation-engine — Scandal catalog read model.
--
-- One row per scandalKey: aggregates the matter-level investigations populated
-- by catalog-scandal-key into a public-facing "case" the ADATBÁZIS can list.
-- Headline damage is the MAX member estimate (avoids double-counting fragments
-- of the same affair). person/institution/summary come from the member with
-- the most articles (the canonical fragment). offence_codes is the union across
-- members; is_open is true unless every member is in a terminal stage.
-- Additive, read-only (Principle VII).

CREATE VIEW "ScandalCatalog" AS
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
