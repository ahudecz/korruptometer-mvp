import { describe, expect, it } from 'vitest';
import { decideStatus } from './review';
import { isWatchlistPerson, normalizeName } from './watchlist';

describe('decideStatus', () => {
  it('discards below the 0.70 floor (FR-005)', () => {
    expect(decideStatus(0.64, false)).toBe('discard');
    expect(decideStatus(0.69, false)).toBe('discard');
    expect(decideStatus(0.0, false)).toBe('discard');
  });

  it('auto-publishes >= 0.90 for non-watchlist (FR-003)', () => {
    expect(decideStatus(0.9, false)).toBe('approved');
    expect(decideStatus(0.93, false)).toBe('approved');
    expect(decideStatus(1.0, false)).toBe('approved');
  });

  it('queues 0.70–0.8999 for review (FR-004)', () => {
    expect(decideStatus(0.7, false)).toBe('pending');
    expect(decideStatus(0.82, false)).toBe('pending');
    expect(decideStatus(0.8999, false)).toBe('pending');
  });

  it('never auto-approves a watchlist person, even at high confidence (FR-006)', () => {
    expect(decideStatus(0.95, true)).toBe('pending');
    expect(decideStatus(0.9, true)).toBe('pending');
    expect(decideStatus(0.75, true)).toBe('pending');
  });

  it('still discards a watchlist person below the floor (no false publish, no flood)', () => {
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
