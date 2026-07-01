import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  matchesCandidate,
  resolveCluster,
  type CandidateInvestigation,
  type ClaimForCluster,
} from '../../src/lib/investigation/cluster';

const baseClaim: ClaimForCluster = {
  id: 'c1',
  articleSource: 'news',
  articleId: 'a1',
  allegedAmountHuf: 1_000_000_000n,
  parties: [
    { kind: 'person', name: 'Kovács László', normalizedName: 'kovacs laszlo', role: 'főnök' },
  ],
  articlePublishedAt: new Date('2026-04-01T00:00:00Z'),
};

const baseCandidate: CandidateInvestigation = {
  id: 'inv-1',
  primaryPersonName: 'Kovács László',
  primaryPersonNormalized: 'kovacs laszlo',
  primaryEntityName: null,
  articleCount: 2,
  minClaimDate: new Date('2026-03-15T00:00:00Z'),
  maxClaimDate: new Date('2026-04-20T00:00:00Z'),
  partyNames: ['kovacs laszlo', 'kis kft'],
  hasAnyAmount: true,
  minAmount: 800_000_000n,
  maxAmount: 1_200_000_000n,
};

describe('clustering predicates (T025)', () => {
  it('FR-008 default path: name overlap + 2× amount band + ±180d', () => {
    expect(matchesCandidate(baseClaim, baseCandidate)).toBe(true);
  });

  it('FR-008 fails when amount falls outside the 2× band', () => {
    const claim: ClaimForCluster = { ...baseClaim, allegedAmountHuf: 50_000_000n };
    // Need to also break the unknown-amount path so this isn't accepted by it.
    expect(matchesCandidate(claim, baseCandidate)).toBe(false);
  });

  it('FR-008 fails when no name overlap', () => {
    const claim: ClaimForCluster = {
      ...baseClaim,
      parties: [
        { kind: 'person', name: 'Tóth Béla', normalizedName: 'toth bela', role: 'tag' },
      ],
    };
    expect(matchesCandidate(claim, baseCandidate)).toBe(false);
  });

  it('FR-009 unknown-amount path: needs ≥ 2 distinct name overlap and ±90d', () => {
    const claim: ClaimForCluster = {
      ...baseClaim,
      allegedAmountHuf: null,
      parties: [
        { kind: 'person', name: 'Kovács László', normalizedName: 'kovacs laszlo', role: 'főnök' },
        { kind: 'entity', name: 'Kis Kft.', normalizedName: 'kis kft', role: 'nyertes' },
      ],
    };
    const candidate: CandidateInvestigation = {
      ...baseCandidate,
      hasAnyAmount: false,
      minAmount: null,
      maxAmount: null,
      minClaimDate: new Date('2026-03-15T00:00:00Z'),
      maxClaimDate: new Date('2026-03-30T00:00:00Z'),
    };
    expect(matchesCandidate(claim, candidate)).toBe(true);
  });

  it('FR-009 fails with only one overlapping name', () => {
    const claim: ClaimForCluster = {
      ...baseClaim,
      allegedAmountHuf: null,
      parties: [
        { kind: 'person', name: 'Kovács László', normalizedName: 'kovacs laszlo', role: 'főnök' },
      ],
    };
    const candidate: CandidateInvestigation = {
      ...baseCandidate,
      hasAnyAmount: false,
      minAmount: null,
      maxAmount: null,
    };
    expect(matchesCandidate(claim, candidate)).toBe(false);
  });

  it('FR-010 → ambiguous when two candidates pass', () => {
    const c2 = { ...baseCandidate, id: 'inv-2' };
    const res = resolveCluster(baseClaim, [baseCandidate, c2]);
    expect(res.kind).toBe('ambiguous');
    if (res.kind === 'ambiguous') {
      expect(res.candidateIds).toEqual(['inv-1', 'inv-2']);
    }
  });

  it('FR-011 → new when zero candidates pass', () => {
    const candidate: CandidateInvestigation = {
      ...baseCandidate,
      partyNames: ['someone unrelated'],
    };
    const res = resolveCluster(baseClaim, [candidate]);
    expect(res.kind).toBe('new');
  });

  it('attach when exactly one passes', () => {
    const res = resolveCluster(baseClaim, [baseCandidate]);
    expect(res).toEqual({ kind: 'attach', investigationId: 'inv-1' });
  });
});
