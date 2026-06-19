-- 002-investigation-engine — Case Catalog read model.
--
-- A convenience VIEW over Investigation that exposes the catalog axes with
-- offence-type labels resolved and an is_open flag (open = procedural stage not
-- in a terminal state). Unifies both bootstrap cases (caseKeySource LIKE
-- 'kmonitor_%') and LLM-clustering-engine investigations (null caseKeySource).
-- Excludes merged/dismissed cases. Additive, read-only (Principle VII).

CREATE VIEW "CaseCatalog" AS
SELECT
  i.id,
  i."primaryPersonName"       AS person,
  i."primaryEntityName"       AS institution,
  i."offenceTypes"            AS offence_codes,
  ARRAY(
    SELECT o."labelHu" FROM "OffenceTypeRef" o
    WHERE o.code = ANY (i."offenceTypes")
    ORDER BY o."sortOrder"
  )                           AS offence_labels,
  i."proceduralStage"         AS procedural_stage,
  i."competentAuthority"      AS competent_authority,
  i."matterTier"              AS matter_tier,
  i."qualityScore"            AS evidence_grade,
  i."articleCount"            AS article_count,
  i.summary,
  (
    i."proceduralStage" IS NULL
    OR i."proceduralStage" NOT IN ('final_verdict', 'closed_no_charge', 'acquitted')
  )                           AS is_open,
  i."caseKeySource"           AS case_key_source,
  i."createdAt"               AS created_at
FROM "Investigation" i
WHERE i.status NOT IN ('merged', 'dismissed');
