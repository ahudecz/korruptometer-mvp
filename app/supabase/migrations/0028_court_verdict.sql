-- Court verdicts (bírósági ítéletek) — backing table for /birosagi-iteletek.
-- The 002-make-facebook-social-feed branch added the Drizzle model + page but
-- shipped no SQL migration (the table was created via drizzle-kit push). This
-- reconstructs it from packages/db/src/schema.ts (courtVerdicts). Additive.

CREATE TABLE IF NOT EXISTS "CourtVerdict" (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "personName"      text NOT NULL,
  "personGaleriaId" text,
  "personUgyId"     text,
  position          text NOT NULL,
  crimes            text[] NOT NULL DEFAULT ARRAY[]::text[],
  "sentenceYears"   integer NOT NULL DEFAULT 0,
  "sentenceMonths"  integer,
  "sentenceLabel"   text,
  "verdictType"     text NOT NULL DEFAULT 'elsőfokú',
  "verdictDate"     timestamptz NOT NULL,
  court             text NOT NULL,
  summary           text NOT NULL,
  "sourceUrls"      text[] NOT NULL DEFAULT ARRAY[]::text[],
  "sourceNames"     text[] NOT NULL DEFAULT ARRAY[]::text[],
  "sourceHeadlines" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "sourceDates"     text[] NOT NULL DEFAULT ARRAY[]::text[],
  "videoId"         text,
  "videoChannel"    text,
  "videoTitle"      text,
  "videoSummary"    text,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  "updatedAt"       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "CourtVerdict_verdictDate_idx" ON "CourtVerdict" ("verdictDate");
CREATE INDEX IF NOT EXISTS "CourtVerdict_personName_idx" ON "CourtVerdict" ("personName");
