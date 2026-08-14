-- Single source of truth for name-dedup normalization, callable from BOTH
-- sides of a SQL equality comparison — so a dedup query can no longer
-- silently drift out of sync with `normalizeName()` in
-- packages/db/src/watchlist.ts the way it did on 2026-08-07 (Fürcht Pál)
-- and again on 2026-08-14 (Láng Géza / Nagy Gábor Bálint): that fix only
-- taught the JS-computed comparison KEY to strip a leading "Dr./Prof./
-- ifj./id." honorific, but every call site hand-rolled its OWN inline SQL
-- regex for the EXISTING row's name — lower+unaccent+punctuation only, no
-- honorific-strip — so "Dr. Láng Géza" (stored) vs. "Láng Géza" (new
-- article) still failed to match and inserted a duplicate row. Mirrors
-- normalizeName() exactly: lower, unaccent, punctuation → space, collapse/
-- trim, then peel up to 2 leading honorific tokens (JS bounds at 4, but no
-- real Hungarian name chains more than one honorific — 2 is a deliberately
-- generous margin, not a hard requirement to track the JS bound exactly).
CREATE OR REPLACE FUNCTION normalize_name(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT regexp_replace(
    regexp_replace(
      trim(regexp_replace(lower(immutable_unaccent(trim(input))), '[^a-z0-9]+', ' ', 'g')),
      '^(dr|prof|ifj|id) ', ''
    ),
    '^(dr|prof|ifj|id) ', ''
  );
$$;
