-- 002-investigation-engine, Addendum 2026-05-19 — Damage→Evidence Spine.
--
-- Adds the data layer that makes the investigation engine's headline numbers
-- auditable: DamageEstimate (per-investigation HUF range with per-mechanism
-- components), SignalContribution (the audited summands behind quantityScore),
-- and InvestigationJobState (real-time async-job tracking surfaced on the
-- detail page). Per constitution Principle VII this migration is additive
-- only (CREATE TYPE, CREATE TABLE, CREATE INDEX) — nothing in 0011 is
-- modified. The migration ships in its own PR ahead of the application code
-- that depends on it.
--
-- See specs/002-investigation-engine/data-model.md §"Addendum 2026-05-19 —
-- Damage→Evidence Spine" for the source of truth.

-- ─── New enum types ─────────────────────────────────────────────────────────

CREATE TYPE damage_confidence AS ENUM ('low', 'medium', 'high');

CREATE TYPE damage_method AS ENUM (
  'benchmark_deviation',
  'claim_consolidation',
  'amendment_delta',
  'industry_estimate'
);

CREATE TYPE signal_source_kind AS ENUM (
  'external_record',
  'red_flag',
  'claim_corroboration',
  'benchmark_deviation'
);

CREATE TYPE job_kind AS ENUM (
  'xref',
  'redflags',
  'hypothesis_loop',
  'benchmarks',
  'damage_recompute'
);

CREATE TYPE job_state AS ENUM ('idle', 'running', 'done', 'failed');

-- corruption_mechanism (declared in 0011) is reused for
-- DamageComponent.mechanism inside the DamageEstimate.components jsonb.
-- No new mechanism enum is introduced.

-- ─── 1. DamageEstimate ──────────────────────────────────────────────────────
-- One row per investigation. Cached HUF damage range + per-mechanism
-- breakdown. Re-computed (debounced) by investigation.damage-recompute on
-- any change to inputs (FR-048).
CREATE TABLE IF NOT EXISTS "DamageEstimate" (
  "investigationId"      uuid              PRIMARY KEY
                           REFERENCES "Investigation"(id) ON DELETE CASCADE,
  "totalLowHuf"          bigint            NOT NULL,
  "totalHighHuf"         bigint            NOT NULL,
  confidence             damage_confidence NOT NULL,
  components             jsonb             NOT NULL,
  "inputsHash"           text              NOT NULL,
  "computedAt"           timestamptz       NOT NULL DEFAULT now(),
  -- Denormalized for the queue KPI's "no estimate yet" filter (avoids
  -- jsonb_array_length in WHERE clauses).
  "componentCount"       integer           GENERATED ALWAYS AS
                                             (jsonb_array_length(components))
                                             STORED,
  CONSTRAINT "DamageEstimate_totals_nonneg"
    CHECK ("totalLowHuf" >= 0 AND "totalHighHuf" >= "totalLowHuf"),
  CONSTRAINT "DamageEstimate_components_is_array"
    CHECK (jsonb_typeof(components) = 'array'),
  CONSTRAINT "DamageEstimate_inputsHash_sha256"
    CHECK (length("inputsHash") = 64)
);

CREATE INDEX IF NOT EXISTS "DamageEstimate_computedAt_idx"
  ON "DamageEstimate" ("computedAt");

-- Partial index: cases that have been touched by the recompute but produced
-- zero components (no extractable evidence yet). Drives the "no estimate"
-- filter on the queue KPI.
CREATE INDEX IF NOT EXISTS "DamageEstimate_empty_components_idx"
  ON "DamageEstimate" ("investigationId")
  WHERE "componentCount" = 0;

-- ─── 2. SignalContribution ──────────────────────────────────────────────────
-- One row per signal that contributes to Investigation.quantityScore. The
-- generated effectiveWeight column makes the FR-051 invariant
-- (quantityScore = Σ effectiveWeight ± 0.01) trivially auditable.
CREATE TABLE IF NOT EXISTS "SignalContribution" (
  id                     uuid             NOT NULL DEFAULT gen_random_uuid()
                                            PRIMARY KEY,
  "investigationId"      uuid             NOT NULL
                           REFERENCES "Investigation"(id) ON DELETE CASCADE,
  "sourceKind"           signal_source_kind NOT NULL,
  "sourceId"             text             NOT NULL,
  "baseWeight"           numeric(4, 2)    NOT NULL,
  "stalenessMultiplier"  numeric(3, 2)    NOT NULL,
  "effectiveWeight"      numeric(5, 2)    GENERATED ALWAYS AS
                                            ("baseWeight" * "stalenessMultiplier")
                                            STORED,
  "addedAt"              timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT "SignalContribution_baseWeight_range"
    CHECK ("baseWeight" >= 0 AND "baseWeight" <= 5.00),
  CONSTRAINT "SignalContribution_staleness_range"
    CHECK ("stalenessMultiplier" > 0 AND "stalenessMultiplier" <= 1.00)
);

CREATE INDEX IF NOT EXISTS "SignalContribution_investigation_idx"
  ON "SignalContribution" ("investigationId");

-- One row per (case, signal); re-runs upsert on this key.
CREATE UNIQUE INDEX IF NOT EXISTS "SignalContribution_uq"
  ON "SignalContribution" ("investigationId", "sourceKind", "sourceId");

-- Reverse lookup when a source row changes (used to invalidate the cache
-- on the originating side).
CREATE INDEX IF NOT EXISTS "SignalContribution_source_idx"
  ON "SignalContribution" ("sourceKind", "sourceId");

-- ─── 3. InvestigationJobState ──────────────────────────────────────────────
-- Latest state of each reviewer-triggered Inngest run per investigation.
-- Polled / streamed by the detail-page pipeline panel.
CREATE TABLE IF NOT EXISTS "InvestigationJobState" (
  "investigationId"      uuid             NOT NULL
                           REFERENCES "Investigation"(id) ON DELETE CASCADE,
  "jobKind"              job_kind         NOT NULL,
  state                  job_state        NOT NULL DEFAULT 'idle',
  "startedAt"            timestamptz      NULL,
  "finishedAt"           timestamptz      NULL,
  "inngestRunId"         text             NULL,
  summary                text             NULL,
  "errorMessage"         text             NULL,
  "updatedAt"            timestamptz      NOT NULL DEFAULT now(),
  PRIMARY KEY ("investigationId", "jobKind"),
  CONSTRAINT "InvestigationJobState_started_when_active"
    CHECK ((state IN ('running', 'done', 'failed')) = ("startedAt" IS NOT NULL)),
  CONSTRAINT "InvestigationJobState_finished_when_terminal"
    CHECK ((state IN ('done', 'failed')) = ("finishedAt" IS NOT NULL)),
  -- A `done` state MUST carry a Hungarian summary; `failed` MUST carry a
  -- Hungarian errorMessage (pre-translated through tError() — never raw).
  CONSTRAINT "InvestigationJobState_done_has_summary"
    CHECK (state <> 'done' OR summary IS NOT NULL),
  CONSTRAINT "InvestigationJobState_failed_has_error"
    CHECK (state <> 'failed' OR "errorMessage" IS NOT NULL)
);

-- Partial index used by the polling/SSE endpoint to find live jobs cheaply
-- without scanning the (mostly idle) table.
CREATE INDEX IF NOT EXISTS "InvestigationJobState_running_idx"
  ON "InvestigationJobState" ("investigationId", "updatedAt")
  WHERE state = 'running';
