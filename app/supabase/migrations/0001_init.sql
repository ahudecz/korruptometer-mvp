-- Korruptométer initial schema (Phase 1 tables only).
-- FR-002: enable extensions required for accent-insensitive search and KPI primitives.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE case_status AS ENUM ('Lezárva', 'Vádemelés', 'Folyamatban');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sector AS ENUM (
    'Közbeszerzés',
    'Önkormányzat',
    'Állami vállalat',
    'EU pályázat',
    'Egészségügy',
    'Egyéb'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE detention AS ENUM ('loose', 'wanted', 'busted', 'pretrial', 'investig');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE source_tag AS ENUM ('investigative', 'national', 'regional', 'agency', 'newsletter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Case ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Case" (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  position        text NOT NULL,
  amount          bigint NOT NULL,
  "sentenceYears" integer NOT NULL,
  "caseYear"      integer NOT NULL,
  status          case_status NOT NULL,
  region          text NOT NULL,
  sector          sector NOT NULL,
  summary         text,
  "createdAt"     timestamptz NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Case_amount_idx" ON "Case"(amount DESC);
CREATE INDEX IF NOT EXISTS "Case_year_idx"   ON "Case"("caseYear");
CREATE INDEX IF NOT EXISTS "Case_sector_idx" ON "Case"(sector);
CREATE INDEX IF NOT EXISTS "Case_region_idx" ON "Case"(region);
CREATE INDEX IF NOT EXISTS "Case_status_idx" ON "Case"(status);

-- ─── RogueProfile (1:1 with Case) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "RogueProfile" (
  "caseId"         text PRIMARY KEY REFERENCES "Case"(id) ON DELETE CASCADE,
  variant          integer NOT NULL,
  glasses          boolean NOT NULL DEFAULT false,
  hair             text NOT NULL,
  detention        detention NOT NULL,
  "detentionLabel" text NOT NULL,
  crimes           text[] NOT NULL,
  "extraStatus"    text,
  "mugshotUrl"     text,
  "createdAt"      timestamptz NOT NULL DEFAULT now()
);

-- ─── Source ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Source" (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text NOT NULL UNIQUE,
  name                  text NOT NULL,
  homepage              text NOT NULL,
  tag                   source_tag NOT NULL,
  enabled               boolean NOT NULL DEFAULT true,
  "lastScrapedAt"       timestamptz,
  "lastSuccessAt"       timestamptz,
  "consecutiveFailures" integer NOT NULL DEFAULT 0,
  "createdAt"           timestamptz NOT NULL DEFAULT now()
);

-- ─── NewsArticle ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "NewsArticle" (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceId"        uuid NOT NULL REFERENCES "Source"(id) ON DELETE CASCADE,
  headline          text NOT NULL,
  excerpt           text NOT NULL,
  "sourceUrl"       text NOT NULL,
  "sourceUrlHash"   text NOT NULL,
  "publishedAt"     timestamptz NOT NULL,
  tag               text,
  "relatedCaseId"   text REFERENCES "Case"(id) ON DELETE SET NULL,
  "linkConfidence"  integer,
  "linkOverridden"  boolean NOT NULL DEFAULT false,
  featured          boolean NOT NULL DEFAULT false,
  "createdAt"       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "NewsArticle_sourceUrlHash_idx" ON "NewsArticle"("sourceUrlHash");
CREATE INDEX IF NOT EXISTS "NewsArticle_publishedAt_idx"          ON "NewsArticle"("publishedAt" DESC);
CREATE INDEX IF NOT EXISTS "NewsArticle_relatedCaseId_idx"        ON "NewsArticle"("relatedCaseId");

-- ─── KpiSnapshot (single-row by design) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "KpiSnapshot" (
  id                       text PRIMARY KEY DEFAULT 'singleton',
  "computedAt"             timestamptz NOT NULL DEFAULT now(),
  "totalDamage"            bigint NOT NULL,
  "totalPrisonYears"       integer NOT NULL,
  "activeCases"            integer NOT NULL,
  "newIndictmentsThisWeek" integer NOT NULL,
  "partnerCount"           integer NOT NULL,
  "bySector"               jsonb NOT NULL
);
