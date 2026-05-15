-- Rework KMonitorPersonCandidate display layer:
--   * percentile columns (p1/p10/p50/p90/p99) replace median/min/max in the UI;
--   * topTopics jsonb rolls up the per-article `others[]` taxonomy K-Monitor
--     already maintains (sport, IT, építőipar, közbeszerzés, …);
--   * KMonitorArticle and KMonitorPersonArticle let the admin side panel
--     show evidence URLs + topics + claimed HUF amounts per article.

ALTER TABLE "KMonitorPersonCandidate"
  ADD COLUMN IF NOT EXISTS "p1AmountHuf"  bigint,
  ADD COLUMN IF NOT EXISTS "p10AmountHuf" bigint,
  ADD COLUMN IF NOT EXISTS "p50AmountHuf" bigint,
  ADD COLUMN IF NOT EXISTS "p90AmountHuf" bigint,
  ADD COLUMN IF NOT EXISTS "p99AmountHuf" bigint,
  ADD COLUMN IF NOT EXISTS "topTopics"    jsonb;

CREATE TABLE IF NOT EXISTS "KMonitorArticle" (
  "newsId"       integer PRIMARY KEY,
  "sourceUrl"    text NOT NULL DEFAULT '',
  "archiveUrl"   text,
  title          text NOT NULL DEFAULT '',
  "pubTime"      timestamptz,
  "amountHuf"    bigint,
  newspaper      text,
  category       text,
  topics         jsonb,
  institutions   jsonb,
  places         jsonb,
  "importedAt"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "KMonitorArticle_pubTime_idx"   ON "KMonitorArticle"("pubTime");
CREATE INDEX IF NOT EXISTS "KMonitorArticle_newspaper_idx" ON "KMonitorArticle"(newspaper);

CREATE TABLE IF NOT EXISTS "KMonitorPersonArticle" (
  "personId"   uuid    NOT NULL REFERENCES "KMonitorPersonCandidate"(id) ON DELETE CASCADE,
  "newsId"     integer NOT NULL REFERENCES "KMonitorArticle"("newsId")     ON DELETE CASCADE,
  "amountHuf"  bigint,
  PRIMARY KEY ("personId", "newsId")
);

CREATE INDEX IF NOT EXISTS "KMonitorPersonArticle_personId_amount_idx"
  ON "KMonitorPersonArticle"("personId", "amountHuf" DESC NULLS LAST);
