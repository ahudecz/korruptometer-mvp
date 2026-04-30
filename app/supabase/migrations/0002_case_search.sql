-- FR-002: accent-insensitive full-text search on Case.
--
-- Postgres treats `unaccent(text)` as VOLATILE because the dictionary file path
-- is configurable. We can't use it directly inside a generated column. Wrap it
-- in an IMMUTABLE function that names the dictionary explicitly so the planner
-- can include it in the stored expression.

CREATE OR REPLACE FUNCTION immutable_unaccent(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent', input) $$;

ALTER TABLE "Case"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      immutable_unaccent(coalesce(name, '') || ' ' || coalesce(position, '') || ' ' || coalesce(region, ''))
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS "Case_searchVector_gin_idx"
  ON "Case" USING gin ("searchVector");
