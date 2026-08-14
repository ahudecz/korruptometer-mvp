/**
 * Real-Postgres check for the `normalize_name()` SQL function (migration
 * 0052) — the piece that actually broke twice (2026-08-07 Fürcht Pál,
 * 2026-08-14 Láng Géza / Nagy Gábor Bálint). Both incidents were the SAME
 * failure mode: the SQL-side name comparison used inline
 * lower/unaccent/regexp logic re-typed by hand at each call site, which
 * silently drifted out of sync with normalizeName() in watchlist.ts (the
 * honorific-strip step in particular was never added to the SQL side).
 * review.test.ts's mocked isDuplicate() tests only ever asserted the query
 * TEXT (e.g. "does it contain a createdAt clause") — never that the SQL
 * actually normalizes correctly — so that class of bug had no test that
 * could have caught it. This file executes real SQL against a real
 * Postgres instead of asserting query text.
 *
 * Guarded to run ONLY against a loopback/local DATABASE_URL, mirroring
 * guard.ts's assertWriteTarget() host-check — never touches a remote DB
 * even if DATABASE_URL is misconfigured. Skips entirely (not a failure)
 * when no such DB is reachable, e.g. a laptop without a local Postgres
 * running. CI (`app/.github/workflows/ci.yml`) already provisions a fresh
 * `postgres:16` service container with DATABASE_URL pointed at it — this
 * is the first test to actually use it. Creates only the `unaccent`
 * extension + 2 functions (both `CREATE OR REPLACE`, idempotent, safe to
 * run against a real local sandbox DB too); never touches a table.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';

function resolveLocalUrl(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  const isLocal = /^(127\.0\.0\.1|localhost|\[::1\]|::1)$/.test(host);
  return isLocal ? url : null;
}

const localUrl = resolveLocalUrl();

describe.skipIf(!localUrl)('normalize_name() SQL function (real Postgres)', () => {
  let sql: postgres.Sql;

  beforeAll(async () => {
    sql = postgres(localUrl!, { prepare: false, max: 1 });
    await sql`CREATE EXTENSION IF NOT EXISTS unaccent`;
    // Mirrors supabase/migrations/0002_case_search.sql + 0052_normalize_name_function.sql.
    await sql`
      CREATE OR REPLACE FUNCTION immutable_unaccent(input text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE PARALLEL SAFE STRICT
      AS $$ SELECT public.unaccent('public.unaccent', input) $$
    `;
    await sql`
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
      $$
    `;
  });

  afterAll(async () => {
    await sql.end({ timeout: 1 });
  });

  async function normalize(input: string): Promise<string> {
    const [row] = await sql<{ n: string }[]>`SELECT normalize_name(${input}) AS n`;
    return row!.n;
  }

  it('collapses a leading honorific — the 2026-08-14 Láng Géza / Nagy Gábor Bálint bug', async () => {
    expect(await normalize('Dr. Láng Géza')).toBe(await normalize('Láng Géza'));
    expect(await normalize('dr. Nagy Gábor Bálint')).toBe(await normalize('Nagy Gábor Bálint'));
  });

  it('collapses accent-only differences — the 2026-08-03 Hajdú/Hajdu János case', async () => {
    expect(await normalize('Hajdú János')).toBe(await normalize('Hajdu János'));
  });

  it('collapses trailing punctuation', async () => {
    expect(await normalize('Kovács Zoltán!')).toBe(await normalize('Kovács Zoltán'));
  });

  it('does NOT collapse two genuinely different names', async () => {
    expect(await normalize('Integritás Hatóság')).not.toBe(
      await normalize('Tudományos és Technológiai Minisztérium'),
    );
  });

  it('never strips the last remaining token (a name cannot BE just an honorific)', async () => {
    // "Dr" alone has nothing after it to peel down to — must survive intact
    // (lowercased), not collapse to an empty string.
    expect(await normalize('Dr')).toBe('dr');
  });
});
