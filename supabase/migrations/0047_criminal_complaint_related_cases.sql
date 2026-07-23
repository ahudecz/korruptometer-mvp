ALTER TABLE "CriminalComplaint" ADD COLUMN IF NOT EXISTS "relatedCaseIds" text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE "CriminalComplaint" ADD COLUMN IF NOT EXISTS "relatedCaseLabels" text[] NOT NULL DEFAULT ARRAY[]::text[];
