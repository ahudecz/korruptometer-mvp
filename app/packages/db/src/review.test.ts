import { beforeEach, describe, expect, it, vi } from 'vitest';

// Only the two Waberer's/MNB regression tests below (2026-09-07) exercise the
// AI tie-break path (isSameComplaintAi) — every other findExistingComplaint
// test in this file is deliberately built to land in the HIGH (auto-match)
// or below-LOW (null) tier, never invoking this mock. See review.ts's
// isSameComplaintAi() doc for what it's mocking.
vi.mock('./llm', () => ({ llmExtract: vi.fn() }));

import { cleanPositionTitle, complaintMatchScore, COMPLAINT_MATCH_HIGH, COMPLAINT_MATCH_LOW, decideComplaintTransition, decideStatus, findExistingComplaint, findFragmentNameMatch, isBlacklistedComplaintFiler, isDuplicate, isSameComplainant, isSameEntity, isSuspiciouslyEarlyDate, sameApproxComplaintAmount, truncateDescriptionWords } from './review';
import { llmExtract } from './llm';
import { isCalledToResignPerson, isWatchlistPerson, normalizeName } from './watchlist';

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

// 2026-09-01 — Polt Péter user report: isCalledToResignPerson() routes the
// narrower 8-fő set to the auto-publish+notify path (detect-resignations.ts),
// unlike the broader isWatchlistPerson() (still pending-gated for gallery/
// miniszterek).
describe('isCalledToResignPerson', () => {
  it('matches the 8 called-to-resign office holders', () => {
    expect(isCalledToResignPerson('Polt Péter')).toBe(true);
    expect(isCalledToResignPerson('Sulyok Tamás')).toBe(true);
    expect(isCalledToResignPerson('Dr. Polt Péter legfőbb ügyész')).toBe(true);
  });

  it('does NOT match the broader gallery/miniszter watchlist persons', () => {
    expect(isCalledToResignPerson('Orbán Viktor')).toBe(false);
    expect(isCalledToResignPerson('Mészáros Lőrinc')).toBe(false);
    expect(isCalledToResignPerson('Magyar Péter')).toBe(false);
  });

  it('does not match unrelated people', () => {
    expect(isCalledToResignPerson('Kovács Zoltán')).toBe(false);
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

// 2026-09-01 bug report: a criminal_complaint.detect a 444.hu Eximbank-cikkből
// két hamis duplikátumot szúrt be — l. delete-eximbank-duplicate-complaints-
// 2026-09-01.ts a teljes gyökérok-elemzésért. A régi kód a top-1 pg_trgm
// word_similarity()-t vette "best"-nek, stopword-szűrés és összeg-jel nélkül;
// az alábbi két teszt a valós DB-ből visszafejtett jelöltekkel reprodukálja
// mindkét hibát, és igazolja, hogy a javított findExistingComplaint() jól dönt.
describe('findExistingComplaint — 2026-09-01 fix (Eximbank/Tiborcz duplikátumok)', () => {
  it('egy pontosan egyező összeg felülírja a puszta szóátfedést (a valódi Sofitel-sor nyer a magasabb szóátfedésű, de más összegű Duna Aszfalt-sorral szemben)', async () => {
    const rows = [
      {
        id: 'wrong', status: 'nyomozás', filerName: 'Gazdasági és Energetikai Minisztérium', amountLabel: '63 milliárd Ft',
        targetName: 'Szíjj László / Duna Aszfalt — Zambia–Kongó útépítés (Eximbank-hitel)',
      },
      {
        id: 'right', status: 'nyomozás', filerName: 'Gazdasági és Energetikai Minisztérium', amountLabel: '60 milliárd Ft',
        targetName: 'Tiborcz István-közeli cég (Sofitel szálloda) — Eximbank gyorsdöntés',
      },
    ];
    let call = 0;
    const db = { execute: async () => (call++ === 0 ? [] : rows) };
    const match = await findExistingComplaint(db, 'Tiborcz-érdekeltségnek villámgyorsan adott hitel - Eximbank', '60 milliárd Ft');
    expect(match?.id).toBe('right');
  });

  it('a puszta generikus jogi kifejezés (összeg-jel nélkül) nem match-el egy független üggyel', async () => {
    const rows = [
      {
        id: 'unrelated', status: 'nyomozás', filerName: 'Hadházy Ákos', amountLabel: null,
        targetName: 'Simonka György — hivatali visszaélés ügye',
      },
    ];
    let call = 0;
    const db = { execute: async () => (call++ === 0 ? [] : rows) };
    const match = await findExistingComplaint(db, 'Eximbank ellen nyomozás - hivatali visszaélés és hűtlen kezelés', '239,2 millió Ft');
    expect(match).toBeNull();
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

  // 2026-08-25 — recurring duplicate-complaint pattern: different outlets
  // name the same filer with extra context appended (Hajtó Péter / Duna
  // Aszfalt / lélegeztetőgép eset-sorozat).
  describe('substring containment (2026-08-25 fix — no AI needed for this case)', () => {
    it('true when one side just adds a parenthetical role/context', () => {
      expect(isSameComplainant('Pintér Bence', 'Pintér Bence (Győr polgármestere)')).toBe(true);
      expect(isSameComplainant('Miniszterelnökség', 'Miniszterelnökség (Ruff Bálint)')).toBe(true);
    });

    it('still false for two genuinely different institutions, even with overlapping generic words', () => {
      expect(isSameComplainant('Integritás Hatóság', 'Tudományos és Technológiai Minisztérium')).toBe(false);
    });
  });
});

// 2026-09-07 user kérés: a Mi Hazánk feljelentéseit nem vesszük fel
// (duplikátum-eset: két Mi Hazánk-sor ugyanarról az aug. 20-i
// rendezvény-közbeszerzésről, eltérő megfogalmazás miatt a fuzzy
// case/filer-matching sem fogta össze őket).
describe('isBlacklistedComplaintFiler', () => {
  it('true for "Mi Hazánk" regardless of case/accent/suffix', () => {
    expect(isBlacklistedComplaintFiler('Mi Hazánk')).toBe(true);
    expect(isBlacklistedComplaintFiler('mi hazánk')).toBe(true);
    expect(isBlacklistedComplaintFiler('Mi Hazánk Mozgalom')).toBe(true);
  });

  it('false for unrelated filers', () => {
    expect(isBlacklistedComplaintFiler('Integritás Hatóság')).toBe(false);
    expect(isBlacklistedComplaintFiler('Miniszterelnökség')).toBe(false);
  });
});

// 2026-08-30 — Fradiváros-eset: egy szurkolói csoport (25 Mrd) és később a
// Belügyminisztérium (24,947 Mrd) is "feljelentést tett" ugyanarra a
// célra — a filer eltér, de az összeg gyakorlatilag azonos.
describe('sameApproxComplaintAmount', () => {
  it('true for the real Fradiváros amounts (24,947 vs 25 milliárd Ft)', () => {
    expect(sameApproxComplaintAmount('24,947 milliárd Ft', '25 milliárd Ft')).toBe(true);
  });

  it('true for identical amounts', () => {
    expect(sameApproxComplaintAmount('100 milliárd Ft', '100 milliárd Ft')).toBe(true);
  });

  it('false for genuinely different amounts, even same order of magnitude', () => {
    expect(sameApproxComplaintAmount('60 milliárd Ft', '107 milliárd Ft')).toBe(false);
  });

  it('false when either side has no parseable amount', () => {
    expect(sameApproxComplaintAmount(null, '25 milliárd Ft')).toBe(false);
    expect(sameApproxComplaintAmount('25 milliárd Ft', null)).toBe(false);
    expect(sameApproxComplaintAmount(null, null)).toBe(false);
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

// 2026-09-07 user report: két VALÓS duplikátum-pár csúszott át élesben — l.
// merge-duplicate-complaints-2026-09-07.ts a teljes gyökérok-elemzésért és a
// takarításért. Az alábbi tesztek a valós DB-ből visszafejtett stringekkel
// reprodukálják mindkét hibát, és igazolják, hogy a fix (COMPLAINT_MATCH_LOW
// csökkentve + filerName kontextus az AI-döntőbírónak) valóban kezeli őket.
describe('complaintMatchScore — 2026-09-07 fix (Waberer\'s/MFB és MNB duplikátumok)', () => {
  it("a Waberer's-pár pontszáma a RÉGI 0.34-es küszöb alatt volt (ez okozta a bugot: az AI-döntőbíró meg sem kapta a jelöltet)", () => {
    const score = complaintMatchScore(
      "Waberer's — állami kölcsön Tiborcz Istvánhoz kötött cégnek",
      "Magyar Fejlesztési Bank 77 milliárdos kötvényvásárlása a Waberer's-től",
      null,
      '77 milliárd Ft',
    );
    expect(score).toBeCloseTo(0.25, 2);
    expect(score).toBeLessThan(0.34); // a régi küszöb — ezért nem jutott el az AI-ig
    expect(score).toBeGreaterThanOrEqual(COMPLAINT_MATCH_LOW); // az ÚJ küszöb — most már eljut
    expect(score).toBeLessThan(COMPLAINT_MATCH_HIGH); // nem elég magas az auto-matchhez, AI dönt
  });

  it('az MNB-pár pontszáma MÁR a régi küszöb fölött is az ambiguous sávban volt — itt az AI-döntőbíró rossz ítélete volt a hiba, nem a küszöb', () => {
    const score = complaintMatchScore(
      'MNB jegybanki ingatlanügyek — csalás és hűtlen kezelés',
      'MNB-Ingatlan Kft. — ingatlanhasznosítási visszaélések',
      null,
      null,
    );
    expect(score).toBeCloseTo(0.5, 2);
    expect(score).toBeGreaterThanOrEqual(COMPLAINT_MATCH_LOW);
    expect(score).toBeLessThan(COMPLAINT_MATCH_HIGH);
  });
});

describe('findExistingComplaint — AI tie-break receives filerName context (2026-09-07 MNB fix)', () => {
  beforeEach(() => {
    vi.mocked(llmExtract).mockClear();
  });

  it('passes both filer names to the AI prompt when a candidate is in the ambiguous score range', async () => {
    vi.mocked(llmExtract).mockResolvedValueOnce({ data: { same: true }, inputTokens: 0, outputTokens: 0 });
    const rows = [{
      id: 'mnb-row', status: 'feljelentés', filerName: 'MNB (Magyar Nemzeti Bank)', amountLabel: null,
      targetName: 'MNB jegybanki ingatlanügyek — csalás és hűtlen kezelés',
    }];
    let call = 0;
    const db = { execute: async () => (call++ === 0 ? [] : rows) };

    const match = await findExistingComplaint(
      db,
      'MNB-Ingatlan Kft. — ingatlanhasznosítási visszaélések',
      null,
      'Magyar Nemzeti Bank',
    );

    expect(match?.id).toBe('mnb-row');
    expect(llmExtract).toHaveBeenCalledTimes(1);
    const promptArg = vi.mocked(llmExtract).mock.calls[0]![0] as { user: string };
    expect(promptArg.user).toContain('Magyar Nemzeti Bank');
    expect(promptArg.user).toContain('MNB (Magyar Nemzeti Bank)');
  });

  it('a Waberer\'s-pár most már eléri az AI-döntőbírót (a régi küszöbnél nem jutott volna el idáig)', async () => {
    vi.mocked(llmExtract).mockResolvedValueOnce({ data: { same: true }, inputTokens: 0, outputTokens: 0 });
    const rows = [{
      id: 'waberer-row', status: 'feljelentés', filerName: 'Gazdasági és Energetikai Minisztérium', amountLabel: '77 milliárd Ft',
      targetName: "Magyar Fejlesztési Bank 77 milliárdos kötvényvásárlása a Waberer's-től",
    }];
    let call = 0;
    const db = { execute: async () => (call++ === 0 ? [] : rows) };

    const match = await findExistingComplaint(
      db,
      "Waberer's — állami kölcsön Tiborcz Istvánhoz kötött cégnek",
      null,
      'Kapitány István gazdasági miniszter',
    );

    expect(match?.id).toBe('waberer-row');
    expect(llmExtract).toHaveBeenCalledTimes(1);
  });

  it('does not merge two genuinely unrelated candidates in the ambiguous score band just because the AI happens to be asked — a "different" verdict still returns null', async () => {
    // "Tiborcz" gives this pair a real (0.33) score in the ambiguous band —
    // exercises the actual AI-call branch, not the below-LOW short-circuit.
    vi.mocked(llmExtract).mockResolvedValueOnce({ data: { same: false }, inputTokens: 0, outputTokens: 0 });
    const rows = [{
      id: 'unrelated-row', status: 'feljelentés', filerName: 'Hadházy Ákos', amountLabel: null,
      targetName: "Waberer's — állami kölcsön Tiborcz Istvánhoz kötött cégnek",
    }];
    let call = 0;
    const db = { execute: async () => (call++ === 0 ? [] : rows) };

    const match = await findExistingComplaint(db, 'Tiborcz-érdekeltségű cég adóügye', null, 'Valaki más');
    expect(llmExtract).toHaveBeenCalledTimes(1); // valóban az AI-ágon futott át, nem a küszöb alatt szűrődött ki
    expect(match).toBeNull();
  });
});

describe('findExistingComplaint — AI tie-break receives amountLabel context (2026-09-08 Szuverenitásvédelmi Hivatal fix)', () => {
  beforeEach(() => {
    vi.mocked(llmExtract).mockClear();
  });

  it('passes both amounts to the AI prompt when a candidate is in the ambiguous score range', async () => {
    vi.mocked(llmExtract).mockResolvedValueOnce({ data: { same: true }, inputTokens: 0, outputTokens: 0 });
    const rows = [{
      id: 'szuverenitasvedelmi-row', status: 'feljelentés', filerName: 'Miniszterelnökség', amountLabel: '3,67 milliárd Ft',
      targetName: 'A Szuverenitásvédelmi Hivatal propagandacélú költései',
    }];
    let call = 0;
    const db = { execute: async () => (call++ === 0 ? [] : rows) };

    const match = await findExistingComplaint(
      db,
      'Szuverenitásvédelmi Hivatal kommunikációs költségei – hűtlen kezelés gyanúja',
      '3,5 milliárd Ft',
      'Miniszterelnökség',
    );

    expect(match?.id).toBe('szuverenitasvedelmi-row');
    expect(llmExtract).toHaveBeenCalledTimes(1);
    const promptArg = vi.mocked(llmExtract).mock.calls[0]![0] as { user: string };
    expect(promptArg.user).toContain('3,5 milliárd Ft');
    expect(promptArg.user).toContain('3,67 milliárd Ft');
  });
});

describe('findExistingComplaint — Tier 0: deterministic filer+targetEntity match (2026-09-07 user kérés)', () => {
  beforeEach(() => {
    vi.mocked(llmExtract).mockClear();
  });

  it('matches immediately on filer+entity agreement, WITHOUT any AI call, even if the case-label wording is wildly different', async () => {
    const rows = [{
      id: 'entity-row', status: 'feljelentés', filerName: 'Gazdasági és Energetikai Minisztérium', amountLabel: '77 milliárd Ft',
      targetName: 'Egy teljesen máshogy megfogalmazott, a szó-átfedéses pontozót becsapó ügy-címke',
      targetEntity: "Waberer's",
    }];
    let call = 0;
    const db = { execute: async () => (call++ === 0 ? [] : rows) };

    const match = await findExistingComplaint(
      db,
      'Egy másik, semmilyen közös szót nem tartalmazó megfogalmazás',
      null,
      'Gazdasági és Energetikai Minisztérium',
      "Waberer's Zrt.", // isSameEntity substring-tolerálja a "Zrt." toldalékot
    );

    expect(match?.id).toBe('entity-row');
    expect(llmExtract).not.toHaveBeenCalled(); // determinisztikus — nincs AI-hívás
  });

  it('does NOT match on entity alone if the filer differs (still a real independent-complaint guard)', async () => {
    const rows = [{
      id: 'other-filer-row', status: 'feljelentés', filerName: 'Hadházy Ákos', amountLabel: null,
      targetName: "Waberer's ügye", targetEntity: "Waberer's",
    }];
    let call = 0;
    const db = { execute: async () => (call++ === 0 ? [] : rows) };

    const match = await findExistingComplaint(
      db,
      'Teljesen más ügy-leírás, nulla szó-átfedéssel',
      null,
      'Egy harmadik, független bejelentő',
      "Waberer's",
    );

    // Tier 0 nem talál (más a bejelentő), és a nulla szóátfedés miatt Tier 2
    // sem talál semmit — az AI-döntőbíróig sem jut el.
    expect(match).toBeNull();
    expect(llmExtract).not.toHaveBeenCalled();
  });

  it('falls through to the fuzzy/AI path when the new complaint has no targetEntity (old-style call)', async () => {
    vi.mocked(llmExtract).mockResolvedValueOnce({ data: { same: true }, inputTokens: 0, outputTokens: 0 });
    const rows = [{
      id: 'fuzzy-row', status: 'feljelentés', filerName: 'Gazdasági és Energetikai Minisztérium', amountLabel: '77 milliárd Ft',
      targetName: "Magyar Fejlesztési Bank 77 milliárdos kötvényvásárlása a Waberer's-től", targetEntity: "Waberer's",
    }];
    let call = 0;
    const db = { execute: async () => (call++ === 0 ? [] : rows) };

    // targetEntity paraméter nélkül hívva (mint a régi, migráció előtti hívók)
    const match = await findExistingComplaint(
      db,
      "Waberer's — állami kölcsön Tiborcz Istvánhoz kötött cégnek",
      null,
      'Kapitány István gazdasági miniszter',
    );

    expect(match?.id).toBe('fuzzy-row');
    expect(llmExtract).toHaveBeenCalledTimes(1); // Tier 0 kimaradt, a fuzzy+AI út futott
  });
});

describe('isSameEntity', () => {
  it('mirrors isSameComplainant\'s substring-tolerant matching', () => {
    expect(isSameEntity("Waberer's", "Waberer's Zrt.")).toBe(true);
    expect(isSameEntity('MNB', 'Magyar Nemzeti Bank')).toBe(false); // "MNB" túl rövid ahhoz, hogy önmagában megkülönböztető legyen — l. normalizeName
    expect(isSameEntity('Integritás Hatóság', 'Tudományos és Technológiai Minisztérium')).toBe(false);
  });

  it('is false when either side is null/undefined/empty', () => {
    expect(isSameEntity(null, 'Waberer\'s')).toBe(false);
    expect(isSameEntity('Waberer\'s', undefined)).toBe(false);
    expect(isSameEntity('', 'Waberer\'s')).toBe(false);
  });
});

// 2026-09-07 user report: Császár Attila (PoliticalResignation) és Páger Pál
// Attila (ugyanaz) élesben duplikálódott, mert a pontos (intézmény-
// egyeztetett) dedup az intézmény-szöveg eltérése miatt nem ismerte fel a
// második sort. A user kérése: "ha van egyezés, akár csak töredékre" —
// findFragmentNameMatch() ezt a biztonsági hálót adja, a teljes táblán,
// bármely állapotú sorra, ablak és intézmény-egyeztetés nélkül.
describe('findFragmentNameMatch (2026-09-07 user kérés — Császár Attila/Páger Pál Attila eset)', () => {
  it('matches when the new name is a superstring of an existing (shorter) name — a "Páger Pál" → "Páger Pál Attila" eset', async () => {
    const rows = [{ id: 'existing-1', name: 'Páger Pál', sourceUrl: 'https://example.com/eredeti' }];
    const db = { execute: async () => rows };
    const match = await findFragmentNameMatch(db, 'PoliticalResignation', 'name', 'Páger Pál Attila');
    expect(match).toEqual({ id: 'existing-1', name: 'Páger Pál', sourceUrl: 'https://example.com/eredeti' });
  });

  it('matches when the new name is a SHORTER substring of an existing (longer) name', async () => {
    const rows = [{ id: 'existing-2', name: 'Páger Pál Attila', sourceUrl: 'https://example.com/eredeti' }];
    const db = { execute: async () => rows };
    const match = await findFragmentNameMatch(db, 'PoliticalResignation', 'name', 'Páger Pál');
    expect(match?.id).toBe('existing-2');
  });

  it('returns null when there is no overlap at all', async () => {
    const db = { execute: async () => [] };
    const match = await findFragmentNameMatch(db, 'PoliticalResignation', 'name', 'Valaki Teljesen Más');
    expect(match).toBeNull();
  });

  it('does not query for a very short (< 4 char normalized) name, to avoid over-broad matches', async () => {
    let queried = false;
    const db = { execute: async () => { queried = true; return []; } };
    const match = await findFragmentNameMatch(db, 'PoliticalResignation', 'name', 'Ede');
    expect(match).toBeNull();
    expect(queried).toBe(false);
  });
});
