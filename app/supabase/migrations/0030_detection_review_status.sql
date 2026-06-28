-- 0030: Detection review status (003-detection-review-engine).
-- Bevezeti a jóváhagyási kaput a három detektor-táblához, hogy a hírekből
-- detektált sorok auto-publikálhatók (>=0.90, nem-kiemelt), review-ra
-- várhatók, vagy elutasíthatók legyenek.
--
-- Nem-destruktív, két lépcsős (alkotmány VII.): nullable oszlop -> meglévő
-- sorok backfill 'approved'-ra -> SET DEFAULT + SET NOT NULL. A meglévő élő
-- adat 'approved' marad (FR-010 / SC-005). Additív, idempotens.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
    CREATE TYPE review_status AS ENUM ('approved', 'pending', 'rejected');
  END IF;
END$$;

-- ── PoliticalResignation ──────────────────────────────────────────────────
ALTER TABLE "PoliticalResignation" ADD COLUMN IF NOT EXISTS "reviewStatus" review_status;
UPDATE "PoliticalResignation" SET "reviewStatus" = 'approved' WHERE "reviewStatus" IS NULL;
ALTER TABLE "PoliticalResignation" ALTER COLUMN "reviewStatus" SET DEFAULT 'approved';
ALTER TABLE "PoliticalResignation" ALTER COLUMN "reviewStatus" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "PoliticalResignation_reviewStatus_idx"
  ON "PoliticalResignation" ("reviewStatus");

-- ── MediaClosure ──────────────────────────────────────────────────────────
ALTER TABLE "MediaClosure" ADD COLUMN IF NOT EXISTS "reviewStatus" review_status;
UPDATE "MediaClosure" SET "reviewStatus" = 'approved' WHERE "reviewStatus" IS NULL;
ALTER TABLE "MediaClosure" ALTER COLUMN "reviewStatus" SET DEFAULT 'approved';
ALTER TABLE "MediaClosure" ALTER COLUMN "reviewStatus" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "MediaClosure_reviewStatus_idx"
  ON "MediaClosure" ("reviewStatus");

-- ── CourtVerdict ──────────────────────────────────────────────────────────
ALTER TABLE "CourtVerdict" ADD COLUMN IF NOT EXISTS "reviewStatus" review_status;
UPDATE "CourtVerdict" SET "reviewStatus" = 'approved' WHERE "reviewStatus" IS NULL;
ALTER TABLE "CourtVerdict" ALTER COLUMN "reviewStatus" SET DEFAULT 'approved';
ALTER TABLE "CourtVerdict" ALTER COLUMN "reviewStatus" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "CourtVerdict_reviewStatus_idx"
  ON "CourtVerdict" ("reviewStatus");
