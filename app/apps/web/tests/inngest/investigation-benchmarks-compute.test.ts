import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  getDb: () => ({ execute: async () => [] }),
}));

import { DIMENSIONS, cohortHash, specForDimension } from '../../src/lib/investigation/benchmarks';

describe('benchmarks dimension registry (T038)', () => {
  it('exposes a non-empty constrained dimension list', () => {
    expect(DIMENSIONS.length).toBeGreaterThan(0);
    for (const d of DIMENSIONS) {
      expect(d.name).toMatch(/^[a-z][a-z0-9_]+$/);
      expect(Array.isArray(d.recordTypes)).toBe(true);
      expect(Array.isArray(d.sourceSystems)).toBe(true);
      expect(Array.isArray(d.amountPath)).toBe(true);
    }
  });

  it('cohortHash is deterministic and changes with the spec', () => {
    const d = DIMENSIONS[0]!;
    const a = cohortHash(specForDimension(d));
    const b = cohortHash(specForDimension(d));
    expect(a).toBe(b);
    const tweaked = { ...specForDimension(d), recordTypes: ['contract_notice', 'audit_finding'] };
    expect(cohortHash(tweaked)).not.toBe(a);
  });

  it('cohortHash is hex sha256 (64 chars)', () => {
    const h = cohortHash(specForDimension(DIMENSIONS[0]!));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
