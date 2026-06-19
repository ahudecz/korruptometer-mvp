-- 003 financial-evidence layer — TED procurement notices (structured ingest).
--
-- Structured Hungarian contract-award records pulled from TED (the EU
-- procurement journal). The foundation for grounded damage: each notice carries
-- the AWARDED value and the buyer's own pre-tender ESTIMATE, so awarded−estimate
-- is a documented overpricing signal — no headline guessing. Stored standalone
-- here; matched cases get ExternalRecord links to the source notice.
-- Additive only (Principle VII).

CREATE TABLE "TedNotice" (
  "publicationNumber"     text PRIMARY KEY,      -- e.g. "74376-2017"
  "noticeType"            text,
  "title"                 text,
  "cpvMain"               text,                  -- main CPV code
  "cpvAll"                text[] NOT NULL DEFAULT '{}',
  "buyerName"             text,
  "contractors"           text[] NOT NULL DEFAULT '{}',  -- winning economic operators
  "contractorsNorm"       text[] NOT NULL DEFAULT '{}',  -- accent-stripped, for matching
  "valAwardedHuf"         bigint,                -- VAL_TOTAL (what was paid)
  "valEstimatedHuf"       bigint,                -- VAL_ESTIMATED_TOTAL (authority's estimate)
  "currency"              text,
  "pubDate"               date,
  "canonicalUrl"          text NOT NULL,
  "fetchedAt"             timestamptz NOT NULL DEFAULT now(),
  "raw"                   jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX "TedNotice_cpvMain_idx"        ON "TedNotice" ("cpvMain");
CREATE INDEX "TedNotice_contractorsNorm_idx" ON "TedNotice" USING gin ("contractorsNorm");
CREATE INDEX "TedNotice_overrun_idx"        ON "TedNotice" ("valAwardedHuf")
  WHERE "valAwardedHuf" IS NOT NULL AND "valEstimatedHuf" IS NOT NULL;
