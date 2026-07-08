-- Enforces the "description max 7 words" editorial rule (see
-- memory/feedback-media-description-length.md) at the database level, not
-- just by convention — a long sentence-style description breaks the
-- homepage's 2-column KPI grid layout.
--
-- NOT VALID: skips validating pre-existing rows (some legacy descriptions
-- may already run longer) — only NEW inserts/updates are checked. Existing
-- long descriptions can be cleaned up separately without blocking this
-- migration.

ALTER TABLE "PoliticalResignation"
  ADD CONSTRAINT political_resignation_description_word_limit
  CHECK (description IS NULL OR array_length(regexp_split_to_array(btrim(description), '\s+'), 1) <= 7)
  NOT VALID;

ALTER TABLE "MediaClosure"
  ADD CONSTRAINT media_closure_description_word_limit
  CHECK (description IS NULL OR array_length(regexp_split_to_array(btrim(description), '\s+'), 1) <= 7)
  NOT VALID;
