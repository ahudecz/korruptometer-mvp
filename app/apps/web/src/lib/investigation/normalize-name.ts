/**
 * Hungarian person/entity name normalization.
 *
 * Mirrors what the K-Monitor pipeline does in SQL with
 * `unaccent(lower(name))` (see migration 0002_case_search.sql and the
 * `normalizedName` column on KMonitorPersonCandidate). The Python import
 * script computes `normalizedName` upstream; this TS helper produces the
 * identical string in-process so the clustering predicate (research.md §4)
 * and the adapter queries (research.md §3) read from the same key.
 *
 * Steps:
 *   1. NFD-normalize so diacritics become combining marks.
 *   2. Strip combining marks (the unaccent equivalent).
 *   3. Lowercase.
 *   4. Strip the common Hungarian honorifics: `dr.`, `id.`, `ifj.`
 *      (case-insensitive, with or without trailing dot, leading-token only).
 *   5. Collapse internal whitespace.
 */

const HONORIFIC_TOKENS = new Set(['dr', 'id', 'ifj']);

export function normalizeName(input: string | null | undefined): string {
  if (!input) return '';
  let s = input
    .normalize('NFD')
    // strip combining marks: U+0300..U+036F
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

  // Strip leading honorific tokens like "dr.", "id.", "ifj." (one or many).
  // Keep peeling until the leading token is no longer an honorific.
  // Honorifics never appear without an actual name following, so we stop on
  // the first token that doesn't match.
  // Bounded to 4 iterations so a pathological input can't loop.
  for (let i = 0; i < 4; i += 1) {
    const m = s.match(/^([a-zà-ÿ]+)\.?\s+/);
    if (!m) break;
    const token = m[1];
    if (!token) break;
    if (!HONORIFIC_TOKENS.has(token)) break;
    s = s.slice(m[0].length).trim();
  }

  // Collapse multiple spaces.
  s = s.replace(/\s+/g, ' ');
  return s;
}

/**
 * Compare two normalized names for equality (already-normalized inputs).
 * Returns true when both strings match exactly; the caller is responsible
 * for normalizing first.
 */
export function namesOverlap(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(a);
  let n = 0;
  for (const candidate of b) if (set.has(candidate)) n += 1;
  return n;
}
