-- 009-criminal-complaint-tracking follow-up: an "Összeg" (amount) field the
-- user wants on every complaint — short Hungarian label (e.g. "106 milliárd
-- Ft"), NULL when the complaint isn't about a specific sum or no figure is
-- available (rendered as "–" on the public page, not stored as literal text).

ALTER TABLE "CriminalComplaint" ADD COLUMN IF NOT EXISTS "amountLabel" text;
