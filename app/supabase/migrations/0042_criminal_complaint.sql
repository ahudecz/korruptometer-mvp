-- 009-criminal-complaint-tracking: feljelentés-nyomkövető blokk a
-- /birosagi-iteletek oldalon. Tisztán additív (új tábla + új enum), nem
-- érint meglévő oszlopot — nem igényel két lépéses migrációt (Constitution VII).

CREATE TYPE "complaint_status" AS ENUM (
  'feljelentés',
  'nyomozás',
  'vádemelés',
  'ítélet',
  'elutasítva'
);

CREATE TABLE "CriminalComplaint" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "targetName" text NOT NULL,
  "filerName" text NOT NULL,
  "description" text,
  "status" "complaint_status" NOT NULL DEFAULT 'feljelentés',
  "eventDate" timestamptz NOT NULL,
  "filedAt" timestamptz,
  "sourceUrls" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "sourceNames" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "sourceHeadlines" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "sourceDates" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "reviewStatus" "review_status" NOT NULL DEFAULT 'approved',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "CriminalComplaint_eventDate_idx" ON "CriminalComplaint" ("eventDate");
CREATE INDEX "CriminalComplaint_targetName_idx" ON "CriminalComplaint" ("targetName");
CREATE INDEX "CriminalComplaint_reviewStatus_idx" ON "CriminalComplaint" ("reviewStatus");
CREATE INDEX "CriminalComplaint_status_idx" ON "CriminalComplaint" ("status");
