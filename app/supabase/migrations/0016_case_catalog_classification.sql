-- 002-investigation-engine — Case Catalog Classification layer.
--
-- Folds authority-grade classification axes onto the Investigation (the case
-- unit) so the set of investigations becomes a browsable catalog of cases:
--   • Axis 1 — legal offence type (two-level: Btk./UNCAC code -> HU public
--     label), held as a multi-valued text[] of OffenceTypeRef codes.
--   • Axis 4 — competent authority + OLAF matter tier (crime/irregularity).
--   • Axis 5 — procedural stage (criminal-justice pipeline; "open" = any
--     non-terminal stage, decided in app logic).
-- Plus the entity-resolution anchor that guarantees cases are not duplicated:
--   • canonicalCaseKey — a stable identity derived from the strongest available
--     identifier (court no. > procurement ID > entity+contract hash). On
--     re-ingestion a claim resolves to the existing case by this key instead of
--     creating a second one. A partial unique index enforces one LIVE case per
--     key (merged duplicates are exempt).
--
-- Per constitution Principle VII this migration is additive only (CREATE TYPE,
-- CREATE TABLE, ALTER TABLE ADD COLUMN, CREATE INDEX) — nothing in 0011/0012 is
-- modified. Sub-case hierarchy is intentionally NOT added: the pilot runs
-- flat-with-merge (Investigation.mergedIntoId collapses duplicates); a
-- self-referential parentInvestigationId is deferred until the data shows
-- genuine multi-thread mega-cases.
--
-- Btk. section references in the OffenceTypeRef seed are indicative and must be
-- verified against the current Act C of 2012 text during backfill.

-- ─── New enum types ─────────────────────────────────────────────────────────

CREATE TYPE procedural_stage AS ENUM (
  'reported',
  'investigating',
  'suspect_charged',
  'indicted',
  'on_trial',
  'verdict_first_instance',
  'final_verdict',
  'closed_no_charge',
  'acquitted'
);

CREATE TYPE competent_authority AS ENUM (
  'national_police',
  'prosecution',
  'integrity_authority',
  'state_audit_asz',
  'olaf',
  'eppo',
  'court',
  'eu_commission',
  'other',
  'unknown'
);

CREATE TYPE matter_tier AS ENUM (
  'fraud',
  'corruption',
  'conflict_of_interest',
  'irregularity',
  'unknown'
);

-- ─── Offence-type controlled vocabulary (Axis 1) ────────────────────────────

CREATE TABLE "OffenceTypeRef" (
  "code"              text PRIMARY KEY,
  "labelHu"           text NOT NULL,
  "labelEn"           text,
  "btkSection"        text,
  "uncacCategory"     text,
  "matterTierDefault" matter_tier NOT NULL DEFAULT 'unknown',
  "kmonitorTopics"    jsonb NOT NULL DEFAULT '[]'::jsonb,
  "sortOrder"         integer NOT NULL DEFAULT 0,
  "createdAt"         timestamptz NOT NULL DEFAULT now()
);

-- ─── Investigation: classification axes + idempotency anchor ────────────────

ALTER TABLE "Investigation"
  ADD COLUMN "primaryEntityNormalized" text,
  ADD COLUMN "offenceTypes"            text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN "proceduralStage"         procedural_stage,
  ADD COLUMN "competentAuthority"      competent_authority,
  ADD COLUMN "matterTier"              matter_tier,
  ADD COLUMN "canonicalCaseKey"        text,
  ADD COLUMN "caseKeySource"           text;

-- One LIVE case per canonical key; merged duplicates are exempt so a collapsed
-- case never collides with its survivor.
CREATE UNIQUE INDEX "Investigation_canonicalCaseKey_uq"
  ON "Investigation" ("canonicalCaseKey")
  WHERE "canonicalCaseKey" IS NOT NULL AND status <> 'merged';

CREATE INDEX "Investigation_offenceTypes_idx"
  ON "Investigation" USING gin ("offenceTypes");

CREATE INDEX "Investigation_proceduralStage_idx"
  ON "Investigation" ("proceduralStage");

-- ─── Seed: two-level offence-type vocabulary (Btk. <-> UNCAC <-> public) ─────
-- kmonitorTopics drives the deterministic first-pass bootstrap: any article
-- carrying one of these K-Monitor topics is pre-labelled with the offence code
-- before any LLM step. Topics with no clean mapping are left to the LLM.

INSERT INTO "OffenceTypeRef"
  ("code", "labelHu", "labelEn", "btkSection", "uncacCategory", "matterTierDefault", "kmonitorTopics", "sortOrder")
VALUES
  ('bribery',              'Vesztegetés',              'Bribery',                'Btk. 290-294', 'bribery',              'corruption',          '["vesztegetés"]'::jsonb,                          10),
  ('trading_in_influence', 'Befolyással üzérkedés',    'Trading in influence',   'Btk. 299',     'trading_in_influence', 'corruption',          '[]'::jsonb,                                       20),
  ('abuse_of_office',      'Hivatali visszaélés',      'Abuse of office',        'Btk. 305',     'abuse_of_functions',   'corruption',          '["hivatali visszaélés"]'::jsonb,                  30),
  ('embezzlement',         'Sikkasztás',               'Embezzlement',           'Btk. 372',     'embezzlement',         'fraud',               '["sikkasztás"]'::jsonb,                           40),
  ('breach_of_fiduciary',  'Hűtlen kezelés',           'Breach of fiduciary',    'Btk. 376',     'misappropriation',     'fraud',               '["hűtlen kezelés"]'::jsonb,                       50),
  ('fraud',                'Csalás',                   'Fraud',                  'Btk. 373',     NULL,                   'fraud',               '["csalás"]'::jsonb,                               60),
  ('budget_fraud',         'Költségvetési csalás',     'Budget fraud',           'Btk. 396',     NULL,                   'fraud',               '["adócsalás - költségvetési csalás"]'::jsonb,     70),
  ('money_laundering',     'Pénzmosás',                'Money laundering',       'Btk. 399',     'laundering',           'fraud',               '["offshore"]'::jsonb,                             80),
  ('conflict_of_interest', 'Összeférhetetlenség',      'Conflict of interest',   NULL,           'conflict_of_interest', 'conflict_of_interest','["rokonok"]'::jsonb,                              90),
  ('unexplained_wealth',   'Vagyonosodás',             'Unexplained wealth',     NULL,           'illicit_enrichment',   'corruption',          '["vagyonosodás / vagyonnyilatkozat"]'::jsonb,    100);
