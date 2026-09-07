import { describe, expect, it } from 'vitest';
import { hookFor, pickBySeed, resignationHeadline } from './social-copy-variety';

describe('pickBySeed', () => {
  it('is deterministic for the same seed', () => {
    const options = ['a', 'b', 'c', 'd'];
    const first = pickBySeed('same-seed', options);
    const second = pickBySeed('same-seed', options);
    expect(first).toBe(second);
  });

  it('always returns one of the given options', () => {
    const options = ['a', 'b', 'c'];
    for (const seed of ['x', 'y', 'z', 'abc-123', '']) {
      expect(options).toContain(pickBySeed(seed, options));
    }
  });
});

describe('hookFor', () => {
  it('returns a deterministic hook for a known trigger type', () => {
    const a = hookFor('resignation', 'record-1');
    const b = hookFor('resignation', 'record-1');
    expect(a).toBe(b);
    expect(typeof a).toBe('string');
  });

  it('returns undefined for a trigger type with no hook pool (e.g. summary_stats)', () => {
    expect(hookFor('summary_stats', 'record-1')).toBeUndefined();
    expect(hookFor('complaint_milestone', 'record-1')).toBeUndefined();
  });
});

describe('resignationHeadline', () => {
  it('maps known resignation types to their verb', () => {
    expect(resignationHeadline('Kovács János', 'lemondás')).toBe('Kovács János: lemondott!');
    expect(resignationHeadline('Kovács János', 'kirúgás')).toBe('Kovács János: kirúgták!');
    expect(resignationHeadline('Kovács János', 'felmentés')).toBe('Kovács János: felmentették!');
    expect(resignationHeadline('Kovács János', 'visszahívás')).toBe('Kovács János: visszahívták!');
  });

  it('falls back to "távozott!" for an unknown resignation type', () => {
    expect(resignationHeadline('Kovács János', 'egyéb')).toBe('Kovács János: távozott!');
  });
});
