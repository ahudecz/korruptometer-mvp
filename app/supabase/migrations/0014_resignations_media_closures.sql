-- feature/news-and-homepage — Political Resignations & Media Closures trackers.
--
-- Adds the two public-facing trackers introduced alongside the homepage
-- redesign: PoliticalResignation ("Lemondott-e már?") and MediaClosure
-- ("Megszűnt-e már?"), plus the imageUrl column the news grid now renders.
-- Per constitution Principle VII this migration is additive only
-- (CREATE TYPE, CREATE TABLE, CREATE INDEX, ADD COLUMN) — nothing existing
-- is modified or dropped.
--
-- Replaces the drizzle-generated 0000_slimy_khan / 0001_zippy_mockingbird
-- pair, which duplicated the 0001_init..0012 baseline and were out of sync
-- with schema.ts (missing pinned, imageUrl, MediaClosure and the
-- 'Hivatalban van' enum value). Source of truth: packages/db/src/schema.ts.

-- ─── Political Resignations Tracker ─────────────────────────────────────────

CREATE TYPE resignation_type AS ENUM (
  'lemondás',
  'kirúgás',
  'felmentés',
  'egyéb',
  'Hivatalban van'
);

CREATE TABLE "PoliticalResignation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "position" text NOT NULL,
  "institution" text NOT NULL,
  "resignationType" resignation_type NOT NULL,
  "resignationDate" timestamp with time zone NOT NULL,
  "description" text,
  "pinned" boolean DEFAULT false NOT NULL,
  "sourceUrls" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "sourceNames" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "relatedCaseId" text REFERENCES "Case"("id") ON DELETE SET NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "PoliticalResignation_resignationDate_idx" ON "PoliticalResignation" ("resignationDate");
CREATE INDEX "PoliticalResignation_institution_idx" ON "PoliticalResignation" ("institution");
CREATE INDEX "PoliticalResignation_resignationType_idx" ON "PoliticalResignation" ("resignationType");

-- ─── Media Closures Tracker ─────────────────────────────────────────────────

CREATE TYPE media_closure_type AS ENUM (
  'megszűnés',
  'leépítés',
  'elmaradt esemény',
  'egyéb'
);

CREATE TABLE "MediaClosure" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "eventType" media_closure_type NOT NULL,
  "description" text,
  "eventDate" timestamp with time zone NOT NULL,
  "sourceUrl" text,
  "sourceName" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "MediaClosure_eventDate_idx" ON "MediaClosure" ("eventDate");
CREATE INDEX "MediaClosure_eventType_idx" ON "MediaClosure" ("eventType");

-- ─── News grid imagery ──────────────────────────────────────────────────────

ALTER TABLE "NewsArticle" ADD COLUMN "imageUrl" text;
