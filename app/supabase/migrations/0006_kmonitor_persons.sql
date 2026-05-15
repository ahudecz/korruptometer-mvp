-- K-Monitor case-discovery layer, pivot from tag-slugs to persons (kmdb_base).
-- Editors curate which named persons become Cases; auto-computed signals
-- (mention count, median HUF amount, top institutions, evidence URLs)
-- come from the kmdb_base parquet importer.

CREATE TABLE IF NOT EXISTS "KMonitorPersonCandidate" (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "displayName"            text NOT NULL,
  "normalizedName"         text NOT NULL UNIQUE,
  "mentionCount"           integer NOT NULL DEFAULT 0,
  "articleCountWithAmount" integer NOT NULL DEFAULT 0,
  "medianAmountHuf"        bigint,
  "p75AmountHuf"           bigint,
  "maxAmountHuf"           bigint,
  "topInstitutions"        jsonb,
  "topPersons"             jsonb,
  "sampleArticles"         jsonb,
  "firstSeenAt"            timestamptz NOT NULL DEFAULT now(),
  "lastSeenAt"             timestamptz NOT NULL DEFAULT now(),
  "approvalState"          kmonitor_approval_state NOT NULL DEFAULT 'pending',
  "caseId"                 text REFERENCES "Case"(id) ON DELETE SET NULL,
  "createdAt"              timestamptz NOT NULL DEFAULT now(),
  "updatedAt"              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "KMonitorPersonCandidate_approvalState_idx"
  ON "KMonitorPersonCandidate"("approvalState");

CREATE INDEX IF NOT EXISTS "KMonitorPersonCandidate_mentionCount_idx"
  ON "KMonitorPersonCandidate"("mentionCount" DESC);
