-- 002-investigation-engine — additive schema for the Investigation Engine.
--
-- Per constitution Principle VII this migration is additive only (CREATE TYPE,
-- CREATE TABLE, CREATE INDEX). The two-step destructive-migration rule does
-- not bind because nothing is dropped or renamed, but the migration still
-- ships in its own PR ahead of the application code that depends on it.
--
-- See specs/002-investigation-engine/data-model.md for the source of truth.

-- pg_trgm is already enabled in 0002_case_search.sql; kept here as
-- belt-and-braces so a fresh database brought up via this migration alone
-- still has the trigram operator class for the Investigation lookups.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── New enum types ─────────────────────────────────────────────────────────

CREATE TYPE article_source AS ENUM ('news', 'kmonitor');

CREATE TYPE corruption_mechanism AS ENUM (
  'overpricing',
  'no_bid',
  'kickback',
  'amendment_inflation',
  'phantom_service',
  'related_party',
  'other'
);

CREATE TYPE amount_basis AS ENUM ('stated', 'computed', 'estimated');

CREATE TYPE investigation_status AS ENUM ('new', 'dismissed', 'merged');

CREATE TYPE disclosure_tier AS ENUM (
  'internal',
  'journalist',
  'prosecutor',
  'public'
);

CREATE TYPE external_source_system AS ENUM (
  'TED',
  'EKR',
  'KE',
  'palyazat',
  'ecegjegyzek',
  'opencorporates',
  'integritas',
  'olaf',
  'ksh',
  'eurostat',
  'kmonitor',
  'atlatszo',
  'webarchive',
  'manual_opten',
  'manual_other'
);

CREATE TYPE relevance AS ENUM (
  'corroborates',
  'contradicts',
  'context',
  'benchmark'
);

CREATE TYPE evidence_grade AS ENUM (
  'rumor',
  'opinion_press',
  'opposition_politician',
  'investigative_journalism',
  'prosecutor_statement',
  'audit_report',
  'court_document'
);

CREATE TYPE redflag_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE redflag_verdict AS ENUM ('pass', 'fail', 'not_applicable');

CREATE TYPE lead_kind AS ENUM (
  'hypothesis',
  'search_lead',
  'reviewer_question',
  'escalation',
  'cluster_ambiguous'
);

CREATE TYPE lead_status AS ENUM ('open', 'tested', 'resolved', 'rejected');

CREATE TYPE lead_actor_kind AS ENUM ('agent', 'reviewer', 'system');

CREATE TYPE party_kind AS ENUM ('person', 'entity');

-- ─── Tables (dependency order) ──────────────────────────────────────────────

-- 1. ArticleExtractionRun — idempotency marker. One row per
--    (articleSource, articleId, extractorVersion) including the zero-claim
--    case (FR-002, FR-003, edge case "zero claims on a normal article").
CREATE TABLE IF NOT EXISTS "ArticleExtractionRun" (
  "articleSource"        article_source NOT NULL,
  "articleId"            text           NOT NULL,
  "extractorVersion"     text           NOT NULL,
  "claimCount"           integer        NOT NULL,
  "extractedAt"          timestamptz    NOT NULL DEFAULT now(),
  "model"                text           NOT NULL,
  "inputTokens"          integer        NOT NULL,
  "outputTokens"         integer        NOT NULL,
  "estimatedHufSpend"    numeric(14, 2) NOT NULL,
  PRIMARY KEY ("articleSource", "articleId", "extractorVersion"),
  CONSTRAINT "ArticleExtractionRun_claimCount_nonneg" CHECK ("claimCount" >= 0)
);

CREATE INDEX IF NOT EXISTS "ArticleExtractionRun_article_extractedAt_idx"
  ON "ArticleExtractionRun" ("articleSource", "articleId", "extractedAt" DESC);

-- 2. ArticleClaim — one atomic allegation extracted from one article.
--    Polymorphic article reference via (articleSource, articleId); no FK.
--    Cleanup is the orphan janitor (FR-006).
CREATE TABLE IF NOT EXISTS "ArticleClaim" (
  id                     uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  "articleSource"        article_source NOT NULL,
  "articleId"            text           NOT NULL,
  "claimOrdinal"         integer        NOT NULL,
  "extractorVersion"     text           NOT NULL,
  mechanism              corruption_mechanism NOT NULL,
  "allegedAmountHuf"     bigint         NULL,
  "amountBasis"          amount_basis   NULL,
  parties                jsonb          NOT NULL,
  "evidenceQuote"        text           NOT NULL,
  "sourceUrl"            text           NOT NULL,
  "paragraphLocator"     text           NOT NULL,
  model                  text           NOT NULL,
  confidence             integer        NOT NULL,
  "createdAt"            timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT "ArticleClaim_idempotency_uq"
    UNIQUE ("articleSource", "articleId", "claimOrdinal", "extractorVersion"),
  -- FR-036: every claim has a re-verifiable source URL + locator + evidence quote.
  CONSTRAINT "ArticleClaim_evidence_nonempty" CHECK (
    length("evidenceQuote") > 0
    AND length("sourceUrl") > 0
    AND length("paragraphLocator") > 0
  ),
  -- Paired nullability: amountBasis is non-null iff allegedAmountHuf is non-null.
  CONSTRAINT "ArticleClaim_amount_paired" CHECK (
    ("allegedAmountHuf" IS NULL) = ("amountBasis" IS NULL)
  ),
  -- Parties must contain at least one entry.
  CONSTRAINT "ArticleClaim_parties_nonempty" CHECK (
    jsonb_typeof(parties) = 'array' AND jsonb_array_length(parties) >= 1
  ),
  -- Confidence is a 0..100 percent.
  CONSTRAINT "ArticleClaim_confidence_range"
    CHECK (confidence BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS "ArticleClaim_article_idx"
  ON "ArticleClaim" ("articleSource", "articleId");

-- jsonb_path_ops gin index for name-overlap probe during clustering.
CREATE INDEX IF NOT EXISTS "ArticleClaim_parties_gin_idx"
  ON "ArticleClaim" USING gin (parties jsonb_path_ops);

-- 3. Investigation — a cluster of claims describing the same case.
CREATE TABLE IF NOT EXISTS "Investigation" (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status                          investigation_status NOT NULL DEFAULT 'new',
  "mergedIntoId"                  uuid NULL REFERENCES "Investigation"(id)
                                    ON DELETE SET NULL,
  "primaryPersonName"             text NULL,
  "primaryPersonNormalized"       text NULL,
  "primaryEntityName"             text NULL,
  summary                         text NULL,
  "quantityScore"                 numeric(6, 2) NOT NULL DEFAULT 0,
  "qualityScore"                  evidence_grade NULL,
  "disclosureTier"                disclosure_tier NOT NULL DEFAULT 'internal',
  "publicCaseId"                  text NULL REFERENCES "Case"(id)
                                    ON DELETE SET NULL,
  "articleCount"                  integer NOT NULL DEFAULT 0,
  "oldestExternalRecordFetchedAt" timestamptz NULL,
  "createdAt"                     timestamptz NOT NULL DEFAULT now(),
  "updatedAt"                     timestamptz NOT NULL DEFAULT now(),
  -- Paired state: mergedIntoId is non-null iff status='merged'.
  CONSTRAINT "Investigation_merged_paired" CHECK (
    (status = 'merged') = ("mergedIntoId" IS NOT NULL)
  ),
  -- articleCount is denormalized; never negative.
  CONSTRAINT "Investigation_articleCount_nonneg" CHECK ("articleCount" >= 0)
);

CREATE INDEX IF NOT EXISTS "Investigation_status_idx"
  ON "Investigation" (status);

CREATE INDEX IF NOT EXISTS "Investigation_tier_status_idx"
  ON "Investigation" ("disclosureTier", status);

-- Nightly-refresh priority order (FR-015).
CREATE INDEX IF NOT EXISTS "Investigation_refresh_priority_idx"
  ON "Investigation" ("articleCount" DESC, "oldestExternalRecordFetchedAt" ASC);

-- Trigram search on primary person name.
CREATE INDEX IF NOT EXISTS "Investigation_primaryPerson_trgm_idx"
  ON "Investigation" USING gist ("primaryPersonNormalized" gist_trgm_ops);

-- Sparse FK index for merged-into navigation.
CREATE INDEX IF NOT EXISTS "Investigation_mergedIntoId_idx"
  ON "Investigation" ("mergedIntoId") WHERE "mergedIntoId" IS NOT NULL;

-- 4. InvestigationArticleLink — many-to-many between investigations and
--    article sources whose claims feed them.
CREATE TABLE IF NOT EXISTS "InvestigationArticleLink" (
  "investigationId"      uuid           NOT NULL
                           REFERENCES "Investigation"(id) ON DELETE CASCADE,
  "articleSource"        article_source NOT NULL,
  "articleId"            text           NOT NULL,
  role                   text           NOT NULL DEFAULT 'primary',
  "createdAt"            timestamptz    NOT NULL DEFAULT now(),
  PRIMARY KEY ("investigationId", "articleSource", "articleId")
);

CREATE INDEX IF NOT EXISTS "InvestigationArticleLink_article_idx"
  ON "InvestigationArticleLink" ("articleSource", "articleId");

-- 5. ExternalRecord — one piece of external evidence per investigation.
CREATE TABLE IF NOT EXISTS "ExternalRecord" (
  id                     uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  "investigationId"      uuid           NOT NULL
                           REFERENCES "Investigation"(id) ON DELETE CASCADE,
  "sourceSystem"         external_source_system NOT NULL,
  "externalId"           text           NOT NULL,
  "canonicalUrl"         text           NOT NULL,
  "fetchedAt"            timestamptz    NOT NULL,
  "fetchHash"            text           NOT NULL,
  "recordType"           text           NOT NULL,
  "rawPayload"           jsonb          NOT NULL,
  relevance              relevance      NULL,
  "evidenceGrade"        evidence_grade NULL,
  "createdAt"            timestamptz    NOT NULL DEFAULT now(),
  -- FR-037: provenance fields non-empty.
  CONSTRAINT "ExternalRecord_provenance_nonempty" CHECK (
    length("canonicalUrl") > 0 AND length("fetchHash") > 0
  ),
  -- Upsert key on nightly refresh (FR-015).
  CONSTRAINT "ExternalRecord_uq"
    UNIQUE ("investigationId", "sourceSystem", "externalId")
);

CREATE INDEX IF NOT EXISTS "ExternalRecord_source_fetched_idx"
  ON "ExternalRecord" ("sourceSystem", "fetchedAt");

CREATE INDEX IF NOT EXISTS "ExternalRecord_investigation_source_idx"
  ON "ExternalRecord" ("investigationId", "sourceSystem");

-- 6. RedFlagCheck — one rule verdict per investigation.
CREATE TABLE IF NOT EXISTS "RedFlagCheck" (
  id                     uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  "investigationId"      uuid             NOT NULL
                           REFERENCES "Investigation"(id) ON DELETE CASCADE,
  "ruleId"               text             NOT NULL,
  severity               redflag_severity NOT NULL,
  verdict                redflag_verdict  NOT NULL,
  "observationHu"        text             NOT NULL,
  -- References to ExternalRecord.id; no per-element FK is possible on an
  -- array column. Orphan-cleanup (nightly) trims stale references.
  "supportingRecordIds"  uuid[]           NOT NULL DEFAULT '{}',
  "evaluatedAt"          timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT "RedFlagCheck_observationHu_nonempty"
    CHECK (length("observationHu") > 0),
  CONSTRAINT "RedFlagCheck_rule_uq" UNIQUE ("investigationId", "ruleId")
);

CREATE INDEX IF NOT EXISTS "RedFlagCheck_investigation_severity_idx"
  ON "RedFlagCheck" ("investigationId", severity);

-- 7. InvestigationLead — hypothesis / search-lead / reviewer-question /
--    escalation / cluster-ambiguous flag.
CREATE TABLE IF NOT EXISTS "InvestigationLead" (
  id                     uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  "investigationId"      uuid             NOT NULL
                           REFERENCES "Investigation"(id) ON DELETE CASCADE,
  kind                   lead_kind        NOT NULL,
  status                 lead_status      NOT NULL DEFAULT 'open',
  question               text             NOT NULL,
  "testedAgainst"        jsonb            NULL,
  finding                text             NULL,
  "createdBy"            lead_actor_kind  NOT NULL,
  "actorEditorId"        uuid             NULL REFERENCES "Editor"(id)
                                            ON DELETE SET NULL,
  "capFired"             text             NULL,
  "createdAt"            timestamptz      NOT NULL DEFAULT now(),
  "resolvedAt"           timestamptz      NULL,
  -- Paired nullability: reviewer-created leads carry an actorEditorId.
  -- Editor deletion sets actorEditorId to null; the matching reviewer-
  -- created row is allowed to keep the createdBy='reviewer' tag with a
  -- null actorEditorId — see plan.md re-evaluation note.
  CONSTRAINT "InvestigationLead_reviewer_actor_paired"
    CHECK (("createdBy" <> 'reviewer') OR ("actorEditorId" IS NOT NULL)
           OR ("resolvedAt" IS NOT NULL)),
  CONSTRAINT "InvestigationLead_capFired_valid" CHECK (
    "capFired" IS NULL
    OR "capFired" IN ('tool_calls', 'tokens', 'wall_clock')
  )
);

CREATE INDEX IF NOT EXISTS "InvestigationLead_investigation_status_idx"
  ON "InvestigationLead" ("investigationId", status);

CREATE INDEX IF NOT EXISTS "InvestigationLead_status_createdAt_idx"
  ON "InvestigationLead" (status, "createdAt");

-- 8. InvestigationPublicCaseLink — append-only history of every public
--    Case row an investigation has been linked to (FR-030 / S6.4).
CREATE TABLE IF NOT EXISTS "InvestigationPublicCaseLink" (
  "investigationId"      uuid        NOT NULL
                           REFERENCES "Investigation"(id) ON DELETE CASCADE,
  -- No FK on Case.id: the Case row may be soft-deleted out-of-band and the
  -- link history must survive (FR-030).
  "publicCaseId"         text        NOT NULL,
  "promotedAt"           timestamptz NOT NULL DEFAULT now(),
  "depromotedAt"         timestamptz NULL,
  "promotedByEditorId"   uuid        NULL REFERENCES "Editor"(id)
                                       ON DELETE SET NULL,
  PRIMARY KEY ("investigationId", "publicCaseId")
);

CREATE INDEX IF NOT EXISTS "InvestigationPublicCaseLink_history_idx"
  ON "InvestigationPublicCaseLink" ("investigationId", "promotedAt" DESC);

-- 9. Benchmark — cached cohort with computed p10/p50/p90 (FR-017/FR-018).
CREATE TABLE IF NOT EXISTS "Benchmark" (
  "cohortHash"           text         PRIMARY KEY,
  dimension              text         NOT NULL,
  "cohortSpec"           jsonb        NOT NULL,
  p10                    numeric      NOT NULL,
  p50                    numeric      NOT NULL,
  p90                    numeric      NOT NULL,
  n                      integer      NOT NULL,
  "memberRecordIds"      uuid[]       NOT NULL,
  "computedAt"           timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT "Benchmark_n_positive" CHECK (n >= 0)
);

CREATE INDEX IF NOT EXISTS "Benchmark_dimension_computedAt_idx"
  ON "Benchmark" (dimension, "computedAt");

-- 10. DailyLlmUsage — per-day, per-model aggregate for the kill switch.
CREATE TABLE IF NOT EXISTS "DailyLlmUsage" (
  day                    date         NOT NULL,
  model                  text         NOT NULL,
  "inputTokens"          bigint       NOT NULL DEFAULT 0,
  "outputTokens"         bigint       NOT NULL DEFAULT 0,
  "estimatedHufSpend"    numeric(14, 2) NOT NULL DEFAULT 0,
  "callCount"            integer      NOT NULL DEFAULT 0,
  "firstCallAt"          timestamptz  NULL,
  "lastCallAt"           timestamptz  NULL,
  PRIMARY KEY (day, model)
);

CREATE INDEX IF NOT EXISTS "DailyLlmUsage_day_idx"
  ON "DailyLlmUsage" (day);
