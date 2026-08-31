import { describe, expect, it } from 'vitest';

import { computeSharePct, sortByVotesDesc } from '../../src/lib/poll-results';

describe('computeSharePct', () => {
  it('returns 0 when there are no votes at all (US2 empty state)', () => {
    expect(computeSharePct(0, 0)).toBe(0);
  });

  it('computes a rounded one-decimal percentage', () => {
    expect(computeSharePct(1, 3)).toBe(33.3);
    expect(computeSharePct(2, 3)).toBe(66.7);
  });

  it('returns 100 when an option has all the votes', () => {
    expect(computeSharePct(5, 5)).toBe(100);
  });
});

describe('sortByVotesDesc', () => {
  it('sorts options by descending vote count (FR-008)', () => {
    const options = [
      { id: 'a', votes: 3 },
      { id: 'b', votes: 10 },
      { id: 'c', votes: 0 },
    ];
    expect(sortByVotesDesc(options).map((o) => o.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the input array', () => {
    const options = [{ id: 'a', votes: 1 }, { id: 'b', votes: 2 }];
    const original = [...options];
    sortByVotesDesc(options);
    expect(options).toEqual(original);
  });
});
