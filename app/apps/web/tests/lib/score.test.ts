import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  computeQuantityScore,
  computeQualityScore,
  stalenessDecay,
} from '../../src/lib/investigation/score';
import type { ExternalRecordDto, RedFlagDto } from '@korr/shared';

function rec(over: Partial<ExternalRecordDto>): ExternalRecordDto {
  return {
    id: 'r' + Math.random(),
    sourceSystem: 'TED',
    externalId: 'x',
    canonicalUrl: 'https://x',
    fetchedAt: new Date().toISOString(),
    fetchHash: 'h',
    recordType: 'contract_notice',
    relevance: 'corroborates',
    evidenceGrade: 'investigative_journalism',
    rawPayload: {},
    ...over,
  };
}

describe('score (T077, FR-024)', () => {
  it('stalenessDecay: 1.0 inside 540 days, 0.5 outside', () => {
    const now = Date.parse('2026-05-15T00:00:00Z');
    expect(stalenessDecay(new Date(now - 100 * 86400_000).toISOString(), now)).toBe(1);
    expect(stalenessDecay(new Date(now - 540 * 86400_000).toISOString(), now)).toBe(1);
    expect(stalenessDecay(new Date(now - 600 * 86400_000).toISOString(), now)).toBe(0.5);
  });

  it('quantityScore counts distinct corroborating source systems', () => {
    const now = Date.parse('2026-05-15T00:00:00Z');
    const recent = new Date(now - 30 * 86400_000).toISOString();
    const records: ExternalRecordDto[] = [
      rec({ sourceSystem: 'TED', fetchedAt: recent, relevance: 'corroborates' }),
      rec({ sourceSystem: 'TED', fetchedAt: recent, relevance: 'corroborates' }),
      rec({ sourceSystem: 'EKR', fetchedAt: recent, relevance: 'corroborates' }),
    ];
    expect(computeQuantityScore(records, [], now)).toBe(2);
  });

  it('quantityScore adds 1.0 per failing medium-or-higher red flag', () => {
    const now = Date.parse('2026-05-15T00:00:00Z');
    const recent = new Date(now - 30 * 86400_000).toISOString();
    const records: ExternalRecordDto[] = [
      rec({ sourceSystem: 'TED', fetchedAt: recent, relevance: 'corroborates' }),
    ];
    const redFlags: RedFlagDto[] = [
      {
        ruleId: 'single_bidder',
        severity: 'high',
        verdict: 'fail',
        observationHu: 'x',
        supportingRecordIds: [],
        evaluatedAt: new Date().toISOString(),
      },
      {
        ruleId: 'low_priority',
        severity: 'low',
        verdict: 'fail',
        observationHu: 'x',
        supportingRecordIds: [],
        evaluatedAt: new Date().toISOString(),
      },
    ];
    expect(computeQuantityScore(records, redFlags, now)).toBe(2);
  });

  it('stale record contributes 0.5×', () => {
    const now = Date.parse('2026-05-15T00:00:00Z');
    const stale = new Date(now - 600 * 86400_000).toISOString();
    const records: ExternalRecordDto[] = [
      rec({ sourceSystem: 'TED', fetchedAt: stale, relevance: 'corroborates' }),
    ];
    expect(computeQuantityScore(records, [], now)).toBe(0.5);
  });

  it('qualityScore = max evidenceGrade across the records (null when none)', () => {
    expect(computeQualityScore([])).toBe(null);
    const records: ExternalRecordDto[] = [
      rec({ evidenceGrade: 'rumor' }),
      rec({ evidenceGrade: 'investigative_journalism' }),
      rec({ evidenceGrade: 'opinion_press' }),
    ];
    expect(computeQualityScore(records)).toBe('investigative_journalism');
  });
});
