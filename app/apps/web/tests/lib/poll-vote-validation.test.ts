import { describe, expect, it } from 'vitest';

import {
  checkHoneypot,
  checkOptionsBelongToQuestion,
  checkSelectionCount,
} from '../../src/lib/poll-validation';

describe('checkHoneypot', () => {
  it('passes when the honeypot field is empty or missing', () => {
    expect(checkHoneypot('')).toEqual({ valid: true });
    expect(checkHoneypot(undefined)).toEqual({ valid: true });
  });

  it('rejects when the honeypot field is filled in (US4, FR-014)', () => {
    const result = checkHoneypot('a robot wrote this');
    expect(result.valid).toBe(false);
  });
});

describe('checkSelectionCount', () => {
  it('rejects 0 selections (US1 edge case)', () => {
    expect(checkSelectionCount([], 1, 5).valid).toBe(false);
  });

  it('rejects more than 5 selections (US1 edge case)', () => {
    const ids = Array.from({ length: 6 }, (_, i) => `id-${i}`);
    expect(checkSelectionCount(ids, 1, 5).valid).toBe(false);
  });

  it('accepts 1-5 selections', () => {
    for (let n = 1; n <= 5; n++) {
      const ids = Array.from({ length: n }, (_, i) => `id-${i}`);
      expect(checkSelectionCount(ids, 1, 5)).toEqual({ valid: true });
    }
  });

  it('rejects duplicate option ids within one submission', () => {
    expect(checkSelectionCount(['a', 'a'], 1, 5).valid).toBe(false);
  });

  it('rejects a non-array or non-string payload', () => {
    expect(checkSelectionCount('not-an-array', 1, 5).valid).toBe(false);
    expect(checkSelectionCount([1, 2], 1, 5).valid).toBe(false);
  });
});

describe('checkOptionsBelongToQuestion', () => {
  it('rejects an unknown option id', () => {
    const valid = new Set(['a', 'b', 'c']);
    expect(checkOptionsBelongToQuestion(['a', 'zzz'], valid).valid).toBe(false);
  });

  it('accepts option ids that all belong to the question', () => {
    const valid = new Set(['a', 'b', 'c']);
    expect(checkOptionsBelongToQuestion(['a', 'b'], valid)).toEqual({ valid: true });
  });
});
