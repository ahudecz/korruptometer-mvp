import { describe, expect, it } from 'vitest';
import { decideStatus, isDuplicate } from './review';
import { isWatchlistPerson, normalizeName } from './watchlist';

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
  it('is true when a matching row exists (institution is irrelevant)', async () => {
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
});
