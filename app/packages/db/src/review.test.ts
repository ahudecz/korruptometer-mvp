import { describe, expect, it } from 'vitest';
import { cleanPositionTitle, decideComplaintTransition, decideStatus, findExistingComplaint, isDuplicate, isSameComplainant, isSuspiciouslyEarlyDate, truncateDescriptionWords } from './review';
import { isWatchlistPerson, normalizeName } from './watchlist';

// Drizzle's `sql` template tag returns an object tree (StringChunk literals
// interleaved with params/nested SQL), not a plain string — this walks it
// back into readable text so a mock db.execute() can assert on the query
// shape (e.g. "does this include the createdAt window clause or not")
// without a live database.
function sqlToText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks;
  if (!chunks) return '';
  return chunks
    .map((c) => {
      const withQueryChunks = c as { queryChunks?: unknown[] };
      if (withQueryChunks?.queryChunks) return sqlToText(c);
      const withValue = c as { value?: unknown[] };
      if (Array.isArray(withValue?.value)) return withValue.value.join('');
      return '?';
    })
    .join('');
}

describe('decideStatus', () => {
  it('discards below the 0.70 floor (FR-005)', () => {
    expect(decideStatus(0.64, false)).toBe('discard');
    expect(decideStatus(0.69, false)).toBe('discard');
    expect(decideStatus(0.0, false)).toBe('discard');
  });

  it('auto-publishes a non-watchlist person >= 0.77', () => {
    expect(decideStatus(0.77, false)).toBe('approved');
    expect(decideStatus(0.93, false)).toBe('approved');
    expect(decideStatus(1.0, false)).toBe('approved');
  });

  it('a watchlist person NEVER auto-publishes, no matter the confidence (2026-07-14 fix)', () => {
    expect(decideStatus(0.95, true)).toBe('pending');
    expect(decideStatus(0.77, true)).toBe('pending');
    expect(decideStatus(1.0, true)).toBe('pending');
  });

  it('queues 0.70–0.7699 for review', () => {
    expect(decideStatus(0.7, false)).toBe('pending');
    expect(decideStatus(0.72, false)).toBe('pending');
    expect(decideStatus(0.7699, false)).toBe('pending');
    expect(decideStatus(0.75, true)).toBe('pending');
  });

  it('discards below the floor regardless of watchlist', () => {
    expect(decideStatus(0.5, true)).toBe('discard');
  });
});

describe('isWatchlistPerson', () => {
  it('matches the 8 called-to-resign office holders', () => {
    expect(isWatchlistPerson('Sulyok Tamás')).toBe(true);
    expect(isWatchlistPerson('Polt Péter')).toBe(true);
  });

  it('matches the 10 gallery persons', () => {
    expect(isWatchlistPerson('Orbán Viktor')).toBe(true);
    expect(isWatchlistPerson('Mészáros Lőrinc')).toBe(true);
  });

  it('is accent- and case-insensitive and tolerates extra words', () => {
    expect(isWatchlistPerson('sulyok tamas')).toBe(true);
    expect(isWatchlistPerson('Dr. Polt Péter legfőbb ügyész')).toBe(true);
  });

  it('does not match unrelated people', () => {
    expect(isWatchlistPerson('Kovács Zoltán')).toBe(false);
    expect(isWatchlistPerson('Bedros J. Róbert')).toBe(false);
  });
});

describe('normalizeName', () => {
  it('lowercases, strips accents and punctuation, collapses spaces', () => {
    expect(normalizeName('  Bús  Balázs! ')).toBe('bus balazs');
    expect(normalizeName('Kovács Zoltán')).toBe('kovacs zoltan');
    expect(normalizeName('Origo szerkesztőség (75%)')).toBe('origo szerkesztoseg 75');
  });

  describe('honorific stripping (2026-08-07 Fürcht Pál bug report)', () => {
    it('normalizes "Dr. X" and "X" to the same key', () => {
      expect(normalizeName('Dr. Fürcht Pál')).toBe(normalizeName('Fürcht Pál'));
      expect(normalizeName('Dr. Fürcht Pál')).toBe('furcht pal');
    });

    it('strips other common Hungarian honorifics (prof, ifj, id)', () => {
      expect(normalizeName('Prof. Kovács Zoltán')).toBe('kovacs zoltan');
      expect(normalizeName('ifj. Kovács Zoltán')).toBe('kovacs zoltan');
      expect(normalizeName('id. Kovács Zoltán')).toBe('kovacs zoltan');
    });

    it('does not strip a name that only coincidentally starts with an honorific-like token', () => {
      // "Id." alone with nothing after it should never eat the whole name.
      expect(normalizeName('Dr')).toBe('dr');
    });
  });
});

// US2 — auto-publish vs. watchlist, exercised the way the detectors call it.
describe('US2 auto-publish vs watchlist (combined)', () => {
  it('auto-publishes a confident, non-watchlist person', () => {
    expect(decideStatus(0.93, isWatchlistPerson('Kovács Zoltán'))).toBe('approved');
  });
  it('queues a confident watchlist person for review instead of auto-publishing (2026-07-14 fix)', () => {
    expect(decideStatus(0.95, isWatchlistPerson('Polt Péter'))).toBe('pending');
  });
});

// US3 — dedup guard (the SQL is mocked; we assert the function's own logic).
describe('isDuplicate', () => {
  it('is true when a matching row exists (institution ignored when omitted)', async () => {
    const db = { execute: async () => [{ exists: 1 }] };
    expect(await isDuplicate(db, { table: 'PoliticalResignation', nameColumn: 'name' }, 'Kovács Zoltán')).toBe(true);
  });
  it('is false when no row exists', async () => {
    const db = { execute: async () => [] };
    expect(await isDuplicate(db, { table: 'MediaClosure', nameColumn: 'name' }, 'Origo.hu')).toBe(false);
  });
  it('short-circuits on an empty name without querying', async () => {
    let queried = false;
    const db = { execute: async () => { queried = true; return []; } };
    expect(await isDuplicate(db, { table: 'CourtVerdict', nameColumn: 'personName' }, '   ')).toBe(false);
    expect(queried).toBe(false);
  });

  // 2026-08-07 — Fürcht Pál bug report, part 2: even after the honorific-
  // stripping fix (normalizeName, see below) makes "Dr. Fürcht Pál" and
  // "Fürcht Pál" match, the OLD default 30-day window would still have
  // waved the duplicate through — the original row was ~54 days old. An
  // exact name match within a table is always the same real-world one-shot
  // event (a person doesn't resign twice under the identical name), so
  // isDuplicate() no longer expires by default. Explicit-window callers
  // (AssetRecovery, which genuinely can have repeat events under the same
  // case label) are unaffected.
  it('does NOT include a createdAt window clause when withinDays is omitted — no expiry', async () => {
    let capturedQuery: unknown;
    const db = { execute: async (query: unknown) => { capturedQuery = query; return []; } };
    await isDuplicate(db, { table: 'PoliticalResignation', nameColumn: 'name' }, 'Fürcht Pál');
    expect(sqlToText(capturedQuery)).not.toContain('createdAt');
  });

  it('still applies an explicit withinDays window when the caller passes one (e.g. AssetRecovery)', async () => {
    let capturedQuery: unknown;
    const db = { execute: async (query: unknown) => { capturedQuery = query; return []; } };
    await isDuplicate(db, { table: 'AssetRecovery', nameColumn: 'caseLabel' }, 'NKA visszafizetés', 14);
    expect(sqlToText(capturedQuery)).toContain('createdAt');
  });

  // 2026-08-23 — Lázár János bug report: he resigned as Magyar Teniszszövetség
  // elnök on 2026-04-12, then separately resigned his országgyűlési képviselő
  // mandátum on 2026-08-20 — same name, unrelated institutions, but the
  // name-only check silently discarded the second, much bigger story as a
  // "duplicate" of the first. isDuplicate() now takes an optional
  // `institution` — omitted, it's the old name-only behavior (still covered
  // by the tests above); passed, a match ALSO requires the institution to
  // reasonably line up.
  describe('institution-aware guard (2026-08-23 Lázár János fix)', () => {
    it('does NOT include an institution clause when institution is omitted', async () => {
      let capturedQuery: unknown;
      const db = { execute: async (query: unknown) => { capturedQuery = query; return []; } };
      await isDuplicate(db, { table: 'PoliticalResignation', nameColumn: 'name' }, 'Lázár János');
      expect(sqlToText(capturedQuery)).not.toContain('institution');
    });

    it('includes an institution clause when institution is passed', async () => {
      let capturedQuery: unknown;
      const db = { execute: async (query: unknown) => { capturedQuery = query; return []; } };
      await isDuplicate(db, { table: 'PoliticalResignation', nameColumn: 'name' }, 'Lázár János', undefined, 'Országgyűlés');
      expect(sqlToText(capturedQuery)).toContain('institution');
    });

    it('a same-name match still counts as duplicate when the mocked query says so (same institution case)', async () => {
      // The institution-comparison itself happens SQL-side (mocked here) —
      // this only asserts the function still surfaces true/false from
      // whatever the query returns, same as before.
      const db = { execute: async () => [{ exists: 1 }] };
      expect(await isDuplicate(db, { table: 'PoliticalResignation', nameColumn: 'name' }, 'Lázár János', undefined, 'Magyar Teniszszövetség')).toBe(true);
    });

    it('a same-name match with a non-matching institution is NOT a duplicate (query returns no rows)', async () => {
      // Simulates the real bug: the row exists (Teniszszövetség), but the
      // SQL institution clause excludes it because this call is checking
      // against 'Országgyűlés' — the mock reflects what Postgres would
      // actually return, not the function inventing the filter itself.
      const db = { execute: async () => [] };
      expect(await isDuplicate(db, { table: 'PoliticalResignation', nameColumn: 'name' }, 'Lázár János', undefined, 'Országgyűlés')).toBe(false);
    });
  });
});

// 009 US2 — monotonic state-machine rule for CriminalComplaint status updates.
describe('decideComplaintTransition', () => {
  it('advances forward through the normal lifecycle', () => {
    expect(decideComplaintTransition('feljelentés', 'nyomozás')).toBe('update');
    expect(decideComplaintTransition('nyomozás', 'vádemelés')).toBe('update');
    expect(decideComplaintTransition('vádemelés', 'ítélet')).toBe('update');
    expect(decideComplaintTransition('feljelentés', 'ítélet')).toBe('update');
  });

  it('marks an equal or backward status as stale (does not regress the row)', () => {
    expect(decideComplaintTransition('nyomozás', 'feljelentés')).toBe('stale');
    expect(decideComplaintTransition('ítélet', 'vádemelés')).toBe('stale');
    expect(decideComplaintTransition('feljelentés', 'feljelentés')).toBe('stale');
    expect(decideComplaintTransition('ítélet', 'ítélet')).toBe('stale');
  });

  it('"elutasítva" is reachable from any non-terminal status', () => {
    expect(decideComplaintTransition('feljelentés', 'elutasítva')).toBe('update');
    expect(decideComplaintTransition('nyomozás', 'elutasítva')).toBe('update');
    expect(decideComplaintTransition('ítélet', 'elutasítva')).toBe('update');
  });

  it('a case can be reopened FROM "elutasítva" into any other status', () => {
    expect(decideComplaintTransition('elutasítva', 'feljelentés')).toBe('update');
    expect(decideComplaintTransition('elutasítva', 'nyomozás')).toBe('update');
  });

  it('re-reporting "elutasítva" again is stale', () => {
    expect(decideComplaintTransition('elutasítva', 'elutasítva')).toBe('stale');
  });
});

describe('findExistingComplaint', () => {
  it('is null when no row exists', async () => {
    const db = { execute: async () => [] };
    expect(await findExistingComplaint(db, 'Orbán-kori gyanús közbeszerzések')).toBeNull();
  });

  it('returns the matched row, including filerName (2026-08-11: needed to tell a second independent complaint apart from a stale re-report)', async () => {
    const db = { execute: async () => [{ id: 'abc', status: 'nyomozás', filerName: 'Integritás Hatóság' }] };
    expect(await findExistingComplaint(db, 'Orbán-kori gyanús közbeszerzések')).toEqual({ id: 'abc', status: 'nyomozás', filerName: 'Integritás Hatóság' });
  });

  it('short-circuits on an empty target name without querying', async () => {
    let queried = false;
    const db = { execute: async () => { queried = true; return []; } };
    expect(await findExistingComplaint(db, '   ')).toBeNull();
    expect(queried).toBe(false);
  });
});

describe('isSameComplainant (2026-08-11 Gondosóra bug: a second, independent complaint about the same case was silently discarded as stale)', () => {
  it('true for the same organization written identically', () => {
    expect(isSameComplainant('Integritás Hatóság', 'Integritás Hatóság')).toBe(true);
  });

  it('true despite case/accent/whitespace differences', () => {
    expect(isSameComplainant('integritás hatóság', '  Integritás   Hatóság  ')).toBe(true);
  });

  it('false for two different filers on the same broader case (Gondosóra: Integritás Hatóság vs. the Ministry)', () => {
    expect(isSameComplainant('Integritás Hatóság', 'Tudományos és Technológiai Minisztérium')).toBe(false);
  });

  it('false when either side is empty', () => {
    expect(isSameComplainant('', 'Integritás Hatóság')).toBe(false);
    expect(isSameComplainant('Integritás Hatóság', '')).toBe(false);
  });
});

describe('truncateDescriptionWords', () => {
  it('leaves a description at or under the limit unchanged', () => {
    expect(truncateDescriptionWords('rövid és tömör leírás')).toBe('rövid és tömör leírás');
  });

  it('cuts a longer description down to 7 words (matches the DB check constraint)', () => {
    const long = 'ez egy nagyon hosszú mondat-szerű leírás ami elrontaná a homepage KPI grid elrendezését';
    const result = truncateDescriptionWords(long);
    // The naive 7-word cut would land on "ami" (a relative pronoun that
    // always continues the sentence) — backed off to the last complete word.
    expect(result).toBe('ez egy nagyon hosszú mondat-szerű leírás');
  });

  it('collapses stray whitespace/newlines before counting words', () => {
    expect(truncateDescriptionWords('  egy   két\t三\nnégy öt hat hét nyolc  ')).toBe('egy két 三 négy öt hat hét');
  });

  it('returns an empty string for empty/whitespace-only input', () => {
    expect(truncateDescriptionWords('   ')).toBe('');
  });

  describe('dangling-word backoff (2026-08-06 IMF/Nagy Márton bug report)', () => {
    it('backs off past an attributive adjective stranded by the word-count cut', () => {
      // Real production bug: source text "...az IMF-ben betöltött helyettes
      // kormányzói tisztségéből" (9 words) sliced to 7 stranded "helyettes"
      // without the noun ("kormányzó") it modifies — nonsensical fragment.
      const source = 'Felmentette Nagy Mártont az IMF-ben betöltött helyettes kormányzói tisztségéből';
      const result = truncateDescriptionWords(source);
      // Cascades twice: the 7-word cut lands on "helyettes" (dangling
      // adjective), and the word before it, "betöltött", is itself a
      // dangling participle too — both get dropped.
      expect(result).toBe('Felmentette Nagy Mártont az IMF-ben');
      expect(result.endsWith('helyettes')).toBe(false);
      expect(result.endsWith('betöltött')).toBe(false);
    });

    it('backs off past a trailing conjunction', () => {
      expect(truncateDescriptionWords('Lemondott a posztjáról és')).toBe('Lemondott a posztjáról');
    });

    it('backs off past a trailing relative pronoun', () => {
      expect(truncateDescriptionWords('Felmentették a vezetői posztról, ami')).toBe('Felmentették a vezetői posztról,');
    });

    it('backs off past a bare trailing article', () => {
      // Cascades through both trailing danglers ("a" then "és").
      expect(truncateDescriptionWords('Bezárt a szerkesztőség és a')).toBe('Bezárt a szerkesztőség');
    });

    it('cascades through multiple trailing danglers', () => {
      expect(truncateDescriptionWords('Kirúgták az igazgatót a volt')).toBe('Kirúgták az igazgatót');
    });

    it('leaves a short, already-complete description untouched', () => {
      expect(truncateDescriptionWords('Kirúgták a Kulturális Minisztériumból')).toBe('Kirúgták a Kulturális Minisztériumból');
    });

    it('applies the same backoff to descriptions already at/under the limit', () => {
      // Not every bad ending comes from truncation — a short LLM output can
      // itself end on a dangler and must be caught the same way.
      expect(truncateDescriptionWords('Felmentették a miniszter helyettes')).toBe('Felmentették a miniszter');
    });

    it('respects a non-default limit (CourtVerdict.description is max 6 words, migration 0035)', () => {
      const source = 'Szakács István: 3 év börtön terrorcselekmény előkészítése miatt';
      const result = truncateDescriptionWords(source, 6);
      expect(result.split(/\s+/)).toHaveLength(6);
      expect(result).toBe('Szakács István: 3 év börtön terrorcselekmény');
    });
  });
});

describe('cleanPositionTitle', () => {
  it('strips the "X-ben betöltött Y" construction down to Y (2026-08-08 Nagy Márton bug report)', () => {
    // Real production bug: position ended up "az IMF-ben betöltött helyettes
    // kormányzó" instead of "helyettes kormányzó" — grammatically fine, but
    // redundant next to institution="IMF" and inconsistent with every other
    // row's plain one-to-three-word style.
    expect(cleanPositionTitle('az IMF-ben betöltött helyettes kormányzó')).toBe('helyettes kormányzó');
  });

  it('handles the "-ban betöltött" variant too', () => {
    expect(cleanPositionTitle('a minisztériumban betöltött államtitkár')).toBe('államtitkár');
  });

  it('strips a bare leading article even without the "betöltött" construction', () => {
    expect(cleanPositionTitle('az elnök')).toBe('elnök');
    expect(cleanPositionTitle('a polgármester')).toBe('polgármester');
  });

  it('leaves an already-clean title untouched', () => {
    expect(cleanPositionTitle('vezérigazgató')).toBe('vezérigazgató');
    expect(cleanPositionTitle('helyettes kormányzó')).toBe('helyettes kormányzó');
    expect(cleanPositionTitle('Nagykövet')).toBe('Nagykövet');
  });

  it('does not touch a word that merely starts with "a"/"az"', () => {
    expect(cleanPositionTitle('Alelnök')).toBe('Alelnök');
    expect(cleanPositionTitle('azonnali intézkedésért felelős biztos')).toBe('azonnali intézkedésért felelős biztos');
  });

  it('trims surrounding whitespace', () => {
    expect(cleanPositionTitle('  az IMF-ben betöltött helyettes kormányzó  ')).toBe('helyettes kormányzó');
  });
});

// 2026-08-25 — Mandiner-eset (Kohán Mátyás et al.): cikk 2026-08-24, a
// modell 2026-06-24-i eseménydátumot extrahált — ugyanaz a nap, 2 hónappal
// korábbra. isSuspiciouslyEarlyDate() erre a mintára figyel.
describe('isSuspiciouslyEarlyDate', () => {
  it('flags the real Mandiner case (2 months + same day-of-month)', () => {
    expect(isSuspiciouslyEarlyDate('2026-06-24', '2026-08-24')).toBe(true);
  });

  it('does not flag a same-day extraction', () => {
    expect(isSuspiciouslyEarlyDate('2026-08-24', '2026-08-24')).toBe(false);
  });

  it('does not flag a few days earlier (plausible — event happened before the article ran)', () => {
    expect(isSuspiciouslyEarlyDate('2026-08-15', '2026-08-24')).toBe(false);
  });

  it('does not flag a LATER date than the article (different failure mode, not this check)', () => {
    expect(isSuspiciouslyEarlyDate('2026-09-01', '2026-08-24')).toBe(false);
  });

  it('respects a custom threshold', () => {
    expect(isSuspiciouslyEarlyDate('2026-08-01', '2026-08-24', 20)).toBe(true);
    expect(isSuspiciouslyEarlyDate('2026-08-01', '2026-08-24', 30)).toBe(false);
  });

  it('is false (fail-safe, not fail-open-to-block) on unparseable dates', () => {
    expect(isSuspiciouslyEarlyDate('not-a-date', '2026-08-24')).toBe(false);
    expect(isSuspiciouslyEarlyDate('2026-08-24', 'not-a-date')).toBe(false);
  });
});
