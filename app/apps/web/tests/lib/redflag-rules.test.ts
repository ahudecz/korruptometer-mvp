import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { RULES, evaluateAll, type RuleInput } from '../../src/lib/investigation/redflag-rules';

const noRecords: RuleInput = {
  investigationId: 'inv-1',
  records: [],
  benchmarkDeviations: [],
  clusterFacts: {
    earliestContractDate: null,
    contractorFoundedAt: null,
    relatedPartyHints: [],
    singleSourceDominanceShare: null,
  },
};

describe('redflag-rules (T064, FR-019/FR-020)', () => {
  it('every rule emits a non-empty observationHu (FR-020)', () => {
    const out = evaluateAll(noRecords);
    expect(out).toHaveLength(RULES.length);
    for (const v of out) {
      expect(v.observationHu.length).toBeGreaterThan(0);
    }
  });

  it('single_bidder: pass when no notices with bidCount=1', () => {
    const out = evaluateAll({
      ...noRecords,
      records: [
        {
          id: 'r1',
          sourceSystem: 'TED',
          externalId: '1',
          canonicalUrl: 'https://x',
          fetchedAt: new Date().toISOString(),
          fetchHash: 'h',
          recordType: 'contract_notice',
          relevance: null,
          evidenceGrade: null,
          rawPayload: { bidCount: 3 },
        },
      ],
    });
    const sb = out.find((v) => v.ruleId === 'single_bidder');
    expect(sb?.verdict).toBe('pass');
  });

  it('single_bidder: fail when a notice carries bidCount=1', () => {
    const out = evaluateAll({
      ...noRecords,
      records: [
        {
          id: 'r2',
          sourceSystem: 'TED',
          externalId: '2',
          canonicalUrl: 'https://x',
          fetchedAt: new Date().toISOString(),
          fetchHash: 'h',
          recordType: 'contract_notice',
          relevance: null,
          evidenceGrade: null,
          rawPayload: { bidCount: 1 },
        },
      ],
    });
    const sb = out.find((v) => v.ruleId === 'single_bidder');
    expect(sb?.verdict).toBe('fail');
    expect(sb?.supportingRecordIds).toContain('r2');
  });

  it('not_applicable when there are no contract notices on the cluster', () => {
    const sb = evaluateAll(noRecords).find((v) => v.ruleId === 'single_bidder');
    expect(sb?.verdict).toBe('not_applicable');
  });
});
