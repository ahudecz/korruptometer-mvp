-- Track when a KMonitorPersonCandidate decision was made and by whom.
-- Powers the "Utolsó döntés / Szerkesztő" line in the admin decision band
-- and the average-latency stat on the admin ribbon.

ALTER TABLE "KMonitorPersonCandidate"
  ADD COLUMN IF NOT EXISTS "decidedAt"  timestamptz,
  ADD COLUMN IF NOT EXISTS "decidedBy"  uuid REFERENCES "Editor"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "KMonitorPersonCandidate_decidedAt_idx"
  ON "KMonitorPersonCandidate"("decidedAt");
