import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  assembleEstimate,
  capComponentsByContract,
  computeAmendmentDelta,
  computeOverpricing,
  computePhantomService,
  computeRelatedPartyEstimate,
  computeSingleBidderPremium,
  dedupClaims,
  DEFAULT_COHORT_MIN_N,
  type CohortFact,
  type ClaimFact,
  type ContractFact,
  type RedFlagFact,
} from '../../src/lib/investigation/damage';

const ID = '00000000-0000-0000-0000-000000000001';

function contract(overrides: Partial<ContractFact> = {}): ContractFact {
  return {
    externalRecordId: 'ext-1',
    sourceSystem: 'TED',
    valueHuf: 1_000_000_000n,
    quantity: 1000,
    dimension: 'road_km',
    amendments: [],
    evidenceGrade: 'investigative_journalism',
    ...overrides,
  };
}

function cohort(overrides: Partial<CohortFact> = {}): CohortFact {
  return {
    cohortHash: 'h1',
    dimension: 'road_km',
    p10: 700_000,
    p50: 850_000,
    p90: 950_000,
    n: 20,
    ...overrides,
  };
}

function flag(overrides: Partial<RedFlagFact> = {}): RedFlagFact {
  return {
    id: 'rf-1',
    ruleId: 'single_bidder',
    verdict: 'fail',
    supportingRecordIds: ['ext-1'],
    ...overrides,
  };
}

function claim(overrides: Partial<ClaimFact> = {}): ClaimFact {
  return {
    id: 'cl-1',
    mechanism: 'phantom_service',
    allegedAmountHuf: 100_000_000n,
    confidence: 70,
    referenceYear: 2024,
    vendorNormalized: 'acme-kft',
    ...overrides,
  };
}

describe('damage.ts — T116 unit coverage', () => {
  describe('FR-041 overpricing benchmark deviation', () => {
    it('uses p10/p90 × quantity to bound the deviation', () => {
      const got = computeOverpricing(contract(), cohort());
      expect(got).not.toBeNull();
      // value=1_000_000_000, p10*qty=700_000_000, p90*qty=950_000_000.
      // low  = value - p90 = 50_000_000; high = value - p10 = 300_000_000.
      expect(got!.lowHuf).toBe('50000000');
      expect(got!.highHuf).toBe('300000000');
      expect(got!.method).toBe('benchmark_deviation');
    });

    it('returns null when n < cohortMinN', () => {
      const got = computeOverpricing(contract(), cohort({ n: 9 }));
      expect(got).toBeNull();
    });

    it('returns null when the contract value is at or below p90', () => {
      const got = computeOverpricing(
        contract({ valueHuf: 600_000_000n }),
        cohort(),
      );
      expect(got).toBeNull();
    });
  });

  describe('FR-042 amendment delta', () => {
    it('multiplies the increase by [0.8, 1.2]', () => {
      const got = computeAmendmentDelta(
        contract({
          amendments: [
            { increaseHuf: 100_000_000n },
            { increaseHuf: 50_000_000n },
          ],
        }),
      );
      expect(got).not.toBeNull();
      expect(got!.lowHuf).toBe('120000000'); // 150M * 0.8
      expect(got!.highHuf).toBe('180000000'); // 150M * 1.2
      expect(got!.method).toBe('amendment_delta');
    });

    it('returns null when there are no positive increases', () => {
      const got = computeAmendmentDelta(contract({ amendments: [] }));
      expect(got).toBeNull();
    });
  });

  describe('FR-043 single-bidder premium', () => {
    it('applies the OECD 5–15 % band', () => {
      const got = computeSingleBidderPremium(contract(), flag());
      expect(got).not.toBeNull();
      expect(got!.lowHuf).toBe('50000000'); // 5%
      expect(got!.highHuf).toBe('150000000'); // 15%
      expect(got!.method).toBe('industry_estimate');
      expect(got!.inputs.citation?.studyId).toMatch(/OECD/);
    });

    it('returns null when the flag verdict is not fail', () => {
      expect(
        computeSingleBidderPremium(contract(), flag({ verdict: 'pass' })),
      ).toBeNull();
    });
  });

  describe('FR-044 related-party estimate', () => {
    it('applies the World-Bank 5–15 % band', () => {
      const got = computeRelatedPartyEstimate(
        contract(),
        flag({ ruleId: 'related_party' }),
      );
      expect(got).not.toBeNull();
      expect(got!.mechanism).toBe('kickback');
      expect(got!.inputs.citation?.studyId).toMatch(/WB/);
    });
  });

  describe('FR-045 phantom service consolidation', () => {
    it('uses min/max of claim amounts when no contract anchor', () => {
      const got = computePhantomService(
        [
          claim({ allegedAmountHuf: 100_000_000n }),
          claim({ id: 'cl-2', allegedAmountHuf: 200_000_000n }),
        ],
        null,
      );
      expect(got).not.toBeNull();
      // No anchor → ±30% band on min/max.
      expect(got!.lowHuf).toBe('70000000'); // 100M * 0.70
      expect(got!.highHuf).toBe('260000000'); // 200M * 1.30
    });

    it('caps to contract value when an anchor is provided', () => {
      const got = computePhantomService(
        [claim({ allegedAmountHuf: 2_000_000_000n })],
        contract({ valueHuf: 1_500_000_000n }),
      );
      expect(got).not.toBeNull();
      expect(got!.lowHuf).toBe('1500000000');
      expect(got!.highHuf).toBe('1500000000');
    });

    it('returns null when no phantom-service claims exist', () => {
      expect(
        computePhantomService([claim({ mechanism: 'overpricing' })], null),
      ).toBeNull();
    });
  });

  describe('FR-046 claim dedup', () => {
    it('collapses claims in the same vendor+year cluster within ±20 %', () => {
      const out = dedupClaims([
        claim({ id: 'cl-1', allegedAmountHuf: 100_000_000n, confidence: 60 }),
        claim({ id: 'cl-2', allegedAmountHuf: 110_000_000n, confidence: 90 }),
        claim({ id: 'cl-3', allegedAmountHuf: 200_000_000n, confidence: 80 }),
      ]);
      expect(out).toHaveLength(2);
      // The highest-confidence claim represents its group.
      expect(out.find((c) => c.id === 'cl-2')?.confidence).toBe(90);
      expect(out.find((c) => c.id === 'cl-3')?.confidence).toBe(80);
    });

    it('passes claims without a vendor/year through unchanged', () => {
      const out = dedupClaims([
        claim({ id: 'a', vendorNormalized: null }),
        claim({ id: 'b', referenceYear: null }),
      ]);
      expect(out.map((c) => c.id).sort()).toEqual(['a', 'b']);
    });
  });

  describe('FR-047 cross-component cap', () => {
    it('caps lower-priority components first when totals exceed contract value', () => {
      const overpricing = computeOverpricing(contract(), cohort())!;
      const phantom = computePhantomService(
        [claim({ allegedAmountHuf: 900_000_000n })],
        contract(),
      )!;
      const capped = capComponentsByContract([overpricing, phantom], [
        contract({ valueHuf: 400_000_000n }),
      ]);
      // overpricing is highest priority, so it should keep its low/high and
      // phantom_service gets capped to whatever remains.
      const capOverpricing = capped.find((c) => c.mechanism === 'overpricing')!;
      const capPhantom = capped.find((c) => c.mechanism === 'phantom_service')!;
      // Overpricing high=300M ≤ 400M cap → unchanged.
      expect(capOverpricing.highHuf).toBe('300000000');
      // Remaining cap for phantom is 400M - 300M = 100M.
      expect(capPhantom.highHuf).toBe('100000000');
      expect(capPhantom.notes).toMatch(/sapka|szerződés/i);
    });
  });

  describe('FR-048 inputsHash short-circuit', () => {
    it('produces a deterministic 64-char hex for fixed inputs', () => {
      const a = assembleEstimate({
        investigationId: ID,
        contracts: [contract()],
        cohorts: [cohort()],
        redFlags: [flag()],
        claims: [],
      });
      const b = assembleEstimate({
        investigationId: ID,
        contracts: [contract()],
        cohorts: [cohort()],
        redFlags: [flag()],
        claims: [],
      });
      expect(a.inputsHash).toBe(b.inputsHash);
      expect(a.inputsHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('cohort too thin', () => {
    it('emits no overpricing component when n < cohortMinN', () => {
      const out = assembleEstimate({
        investigationId: ID,
        contracts: [contract()],
        cohorts: [cohort({ n: 5 })],
        redFlags: [],
        claims: [],
        cohortMinN: DEFAULT_COHORT_MIN_N,
      });
      expect(out.components.find((c) => c.method === 'benchmark_deviation')).toBeUndefined();
    });
  });

  describe('assembleEstimate aggregation', () => {
    it('totals match the SUM of capped components', () => {
      const out = assembleEstimate({
        investigationId: ID,
        contracts: [contract()],
        cohorts: [cohort()],
        redFlags: [flag()],
        claims: [claim()],
      });
      const sumLow = out.components.reduce(
        (acc, c) => acc + BigInt(c.lowHuf),
        0n,
      );
      const sumHigh = out.components.reduce(
        (acc, c) => acc + BigInt(c.highHuf),
        0n,
      );
      expect(out.totalLowHuf).toBe(sumLow.toString());
      expect(out.totalHighHuf).toBe(sumHigh.toString());
    });

    it('confidence is medium when only an investigative-journalism record is present', () => {
      const out = assembleEstimate({
        investigationId: ID,
        contracts: [contract({ evidenceGrade: 'investigative_journalism' })],
        cohorts: [cohort()],
        redFlags: [],
        claims: [],
      });
      expect(out.confidence).toBe('medium');
    });

    it('confidence is high with a court-document anchor and big cohort', () => {
      const out = assembleEstimate({
        investigationId: ID,
        contracts: [contract({ evidenceGrade: 'court_document' })],
        cohorts: [cohort({ n: 40 })],
        redFlags: [],
        claims: [],
      });
      expect(out.confidence).toBe('high');
    });
  });
});
