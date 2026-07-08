-- Adds a short (max 6 word) teaser field to CourtVerdict for the
-- homepage/birosagi-iteletek "legfrissebb" summary blocks (spec
-- 007-political-prosecution-detection). Distinct from the existing
-- `summary` column, which stays a full 1-2 sentence recap.
--
-- Same pattern as 0034_description_word_limit.sql: NOT VALID so existing
-- rows (which predate this column and are NULL) aren't blocked, while all
-- future inserts/updates are checked.

ALTER TABLE "CourtVerdict" ADD COLUMN IF NOT EXISTS "description" text;

ALTER TABLE "CourtVerdict"
  ADD CONSTRAINT court_verdict_description_word_limit
  CHECK (description IS NULL OR array_length(regexp_split_to_array(btrim(description), '\s+'), 1) <= 6)
  NOT VALID;
