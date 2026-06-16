-- 002-investigation-engine, Addendum 2026-05-19 — invariant check.
--
-- T115: assert that every investigation's persisted `quantityScore`
-- equals the SUM of its `SignalContribution.effectiveWeight` within
-- ±0.01 (FR-051, SC-016). Run on staging after the damage-backfill
-- finishes; expected output is zero rows.
--
-- Usage:
--   psql "$DIRECT_URL" -f app/apps/web/scripts/0012_damage_evidence_spine_invariants.sql

\echo 'Invariant: quantityScore = Σ SignalContribution.effectiveWeight ± 0.01'
\echo '------------------------------------------------------------------------'

WITH summed AS (
  SELECT
    i.id                                          AS investigation_id,
    i."quantityScore"                             AS quantity_score,
    ROUND(
      COALESCE(
        (SELECT SUM(sc."effectiveWeight")
           FROM "SignalContribution" sc
          WHERE sc."investigationId" = i.id),
        0
      )::numeric,
      2
    )                                             AS sum_signals
  FROM "Investigation" i
)
SELECT
  investigation_id,
  quantity_score,
  sum_signals,
  (quantity_score - sum_signals) AS drift
FROM summed
WHERE ABS(quantity_score - sum_signals) > 0.01
ORDER BY ABS(quantity_score - sum_signals) DESC;

\echo ''
\echo 'Invariant: every DamageEstimate.components element validates against'
\echo '           the shape contract from data-model.md (mechanism, low/high,'
\echo '           method, inputs.formula non-empty).'
\echo '------------------------------------------------------------------------'

SELECT
  d."investigationId",
  (SELECT COUNT(*)
     FROM jsonb_array_elements(d.components) AS c
    WHERE c->>'mechanism' IS NULL
       OR c->>'lowHuf'    IS NULL
       OR c->>'highHuf'   IS NULL
       OR c->>'method'    IS NULL
       OR (c->'inputs'->>'formula') IS NULL
       OR length(c->'inputs'->>'formula') = 0) AS invalid_components
FROM "DamageEstimate" d
WHERE jsonb_array_length(d.components) > 0
  AND (SELECT COUNT(*)
         FROM jsonb_array_elements(d.components) AS c
        WHERE c->>'mechanism' IS NULL
           OR c->>'lowHuf'    IS NULL
           OR c->>'highHuf'   IS NULL
           OR c->>'method'    IS NULL
           OR (c->'inputs'->>'formula') IS NULL
           OR length(c->'inputs'->>'formula') = 0) > 0;

\echo ''
\echo 'Invariant: DamageEstimate totals match Σ components[*]{low,high}.'
\echo '------------------------------------------------------------------------'

WITH expanded AS (
  SELECT
    d."investigationId",
    d."totalLowHuf",
    d."totalHighHuf",
    SUM(CASE WHEN c.value->>'lowHuf'  ~ '^-?[0-9]+$'
             THEN (c.value->>'lowHuf')::bigint  ELSE 0 END) AS sum_low,
    SUM(CASE WHEN c.value->>'highHuf' ~ '^-?[0-9]+$'
             THEN (c.value->>'highHuf')::bigint ELSE 0 END) AS sum_high
  FROM "DamageEstimate" d,
       LATERAL jsonb_array_elements(d.components) AS c(value)
  GROUP BY d."investigationId", d."totalLowHuf", d."totalHighHuf"
)
SELECT *
FROM expanded
WHERE "totalLowHuf"  <> sum_low
   OR "totalHighHuf" <> sum_high;

\echo ''
\echo 'Done. Every preceding result-set should be empty.'
