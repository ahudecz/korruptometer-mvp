import { describe, expect, it } from 'vitest';

import { decodeCursor, encodeCursor, sortKeyFor } from './cursor';

describe('cursor encode/decode', () => {
  it('round-trips a payload', () => {
    const enc = encodeCursor({ s: 'amount_desc', k: '4200000000', id: 'KM-001' });
    expect(decodeCursor(enc)).toEqual({
      s: 'amount_desc',
      k: '4200000000',
      id: 'KM-001',
    });
  });

  it('rejects malformed cursors', () => {
    expect(decodeCursor('not-base64')).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor(null)).toBeNull();
  });

  it('rejects payloads with unknown sort values', () => {
    const bogus = Buffer.from(JSON.stringify({ s: 'random', k: 1, id: 'x' }))
      .toString('base64')
      .replace(/=+$/, '');
    expect(decodeCursor(bogus)).toBeNull();
  });
});

describe('sortKeyFor — tied-amount stability', () => {
  it('returns the same sort key for two rows tied on amount', () => {
    const a = { amount: 850_000_000n, caseYear: 2020, name: 'N. Imre', id: 'KM-002' };
    const b = { amount: 850_000_000n, caseYear: 2021, name: 'X. Y.', id: 'KM-099' };
    expect(sortKeyFor('amount_desc', a)).toBe(sortKeyFor('amount_desc', b));
    // The tiebreaker is the row id, captured separately in the cursor payload.
    expect(a.id).not.toBe(b.id);
  });

  it('returns caseYear for year_desc and name for name_asc', () => {
    const row = { amount: 1n, caseYear: 2019, name: 'Zoltán', id: 'KM-001' };
    expect(sortKeyFor('year_desc', row)).toBe(2019);
    expect(sortKeyFor('name_asc', row)).toBe('Zoltán');
  });
});
