-- spec-Phase-3 scraper observability: ScraperRun rows + worker heartbeat singleton.

DO $$ BEGIN
  CREATE TYPE scraper_run_status AS ENUM ('running', 'success', 'failure');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ScraperRun" (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceId"      uuid NOT NULL REFERENCES "Source"(id) ON DELETE CASCADE,
  "startedAt"     timestamptz NOT NULL DEFAULT now(),
  "finishedAt"    timestamptz,
  status          scraper_run_status NOT NULL DEFAULT 'running',
  "articlesFound" integer NOT NULL DEFAULT 0,
  "articlesNew"   integer NOT NULL DEFAULT 0,
  "errorMessage"  text
);

CREATE INDEX IF NOT EXISTS "ScraperRun_sourceId_startedAt_idx"
  ON "ScraperRun"("sourceId", "startedAt" DESC);

CREATE TABLE IF NOT EXISTS "WorkerHeartbeat" (
  id text PRIMARY KEY DEFAULT 'singleton',
  at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "WorkerHeartbeat"(id, at)
VALUES ('singleton', now())
ON CONFLICT (id) DO NOTHING;

-- US8 view: counts of stale submissions per bucket (FR-052 + the daily Slack digest).
CREATE OR REPLACE VIEW submission_stale_counts AS
SELECT
  count(*) FILTER (
    WHERE status = 'received' AND "createdAt" < now() - interval '14 days'
  ) AS received_stale,
  count(*) FILTER (
    WHERE status = 'in_review' AND "createdAt" < now() - interval '30 days'
  ) AS in_review_stale
FROM "Submission";
