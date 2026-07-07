-- 006-detection-pipeline-reliability: backlog-safe scan + audit trail for
-- the four LLM detectors (resignations, media closures, court verdicts,
-- asset recoveries). Purely additive — no existing table/column is touched,
-- so the two-step destructive-migration rule (constitution VII) does not
-- apply here.
--
-- One row per (article, detector) pair, written ONLY after a real
-- (non-transient) decision. A transient LLM/API failure must NEVER write a
-- row here — that is what lets the next hourly run automatically retry an
-- article instead of silently losing it forever once it ages out of the
-- old fixed 2h lookback window. See specs/006-detection-pipeline-reliability/.

DO $$ BEGIN
  CREATE TYPE detection_outcome AS ENUM ('inserted', 'discarded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DetectionCheck" (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "articleId"      uuid NOT NULL REFERENCES "NewsArticle"(id) ON DELETE CASCADE,
  "detectorType"   text NOT NULL,
  outcome          detection_outcome NOT NULL,
  reason           text,
  "extractedName"  text,
  confidence       real,
  "checkedAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "DetectionCheck_articleId_detectorType_uq"
  ON "DetectionCheck" ("articleId", "detectorType");
CREATE INDEX IF NOT EXISTS "DetectionCheck_detectorType_idx" ON "DetectionCheck" ("detectorType");
CREATE INDEX IF NOT EXISTS "DetectionCheck_checkedAt_idx" ON "DetectionCheck" ("checkedAt");
