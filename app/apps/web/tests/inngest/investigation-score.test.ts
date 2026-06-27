import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  computeQuantityScore,
  computeQualityScore,
} from '../../src/lib/investigation/score';

describe('investigation.score deterministic recompute (T078)', () => {
  it('produces a stable output for stable input', () => {
    const out1 = computeQuantityScore([], []);
    const out2 = computeQuantityScore([], []);
    expect(out1).toBe(out2);
    expect(computeQualityScore([])).toBe(null);
  });

  it('never combines the two axes into a single number', () => {
    // Sanity: quality is an enum, quantity is a numeric — the engine
    // never returns a tuple/object aggregate to callers (FR-025).
    const q = computeQualityScore([]);
    const n = computeQuantityScore([], []);
    expect(typeof n).toBe('number');
    expect(q === null || typeof q === 'string').toBe(true);
  });
});
