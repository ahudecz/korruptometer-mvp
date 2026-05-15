-- spec-Phase-3 K-Monitor case-discovery layer (FR-076..080).
-- Adds KMonitorTagCandidate for editor-approved tag slugs and a
-- viaArchive flag on NewsArticle so the 404→Wayback fallback (FR-080)
-- is visible to editors.

DO $$ BEGIN
  CREATE TYPE kmonitor_approval_state AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "KMonitorTagCandidate" (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  "firstSeenAt"     timestamptz NOT NULL DEFAULT now(),
  "lastSeenAt"      timestamptz NOT NULL DEFAULT now(),
  "approvalState"   kmonitor_approval_state NOT NULL DEFAULT 'pending',
  "caseId"          text REFERENCES "Case"(id) ON DELETE SET NULL,
  "articleCount"    integer NOT NULL DEFAULT 0,
  "lastTraversedAt" timestamptz,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  "updatedAt"       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "KMonitorTagCandidate_approvalState_idx"
  ON "KMonitorTagCandidate"("approvalState");

CREATE INDEX IF NOT EXISTS "KMonitorTagCandidate_firstSeenAt_idx"
  ON "KMonitorTagCandidate"("firstSeenAt");

ALTER TABLE "NewsArticle"
  ADD COLUMN IF NOT EXISTS "viaArchive" boolean NOT NULL DEFAULT false;
