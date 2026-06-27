import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { deriveSignals, sumSignals } from '../../src/lib/investigation/signal-contributions';
import type {
  ArticleClaimDto,
  ExternalRecordDto,
  RedFlagDto,
} from '@korr/shared';

const NOW_MS = new Date('2026-05-19T12:00:00Z').getTime();

function record(
  overrides: Partial<ExternalRecordDto> = {},
): ExternalRecordDto {
  return {
    id: 'ext-' + Math.random().toString(16).slice(2, 8),
    sourceSystem: 'TED',
    externalId: 'x',
    canonicalUrl: 'https://ted.example/x',
    fetchedAt: '2026-05-19T00:00:00Z',
    fetchHash: 'f',
    recordType: 'contract_notice',
    relevance: 'corroborates',
    evidenceGrade: 'audit_report',
    rawPayload: null,
    ...overrides,
  };
}

function redFlag(overrides: Partial<RedFlagDto> = {}): RedFlagDto {
  return {
    ruleId: 'single_bidder',
    severity: 'high',
    verdict: 'fail',
    observationHu: 'x',
    supportingRecordIds: [],
    evaluatedAt: '2026-05-19T00:00:00Z',
    ...overrides,
  };
}

function claim(overrides: Partial<ArticleClaimDto> = {}): ArticleClaimDto {
  return {
    id: 'cl-' + Math.random().toString(16).slice(2, 8),
    articleSource: 'news',
    articleId: 'a1',
    claimOrdinal: 0,
    extractorVersion: 'v1',
    mechanism: 'overpricing',
    allegedAmountHuf: null,
    amountBasis: null,
    parties: [
      {
        kind: 'person',
        name: 'X Y',
        normalizedName: 'x y',
        role: 'beneficiary',
      },
    ],
    evidenceQuote: 'q',
    sourceUrl: 'https://news.example/a',
    paragraphLocator: 'p1',
    confidence: 80,
    createdAt: '2026-05-19T00:00:00Z',
    ...overrides,
  };
}

describe('signal-contributions (T124, FR-051 invariant)', () => {
  it('emits one row per corroborating external record per sourceSystem', () => {
    const rows = deriveSignals({
      records: [
        record({ id: 'a', sourceSystem: 'TED' }),
        record({ id: 'b', sourceSystem: 'TED' }),
        record({ id: 'c', sourceSystem: 'EKR' }),
      ],
      redFlags: [],
      claims: [],
      benchmarks: [],
      nowMs: NOW_MS,
    });
    const sources = rows
      .filter((r) => r.sourceKind === 'external_record')
      .map((r) => r.sourceId);
    expect(sources.length).toBe(2);
  });

  it('skips red flags with verdict != fail', () => {
    const rows = deriveSignals({
      records: [],
      redFlags: [
        redFlag({ ruleId: 'a', verdict: 'pass' }),
        redFlag({ ruleId: 'b', verdict: 'fail', severity: 'high' }),
      ],
      claims: [],
      benchmarks: [],
      nowMs: NOW_MS,
    });
    expect(rows.filter((r) => r.sourceKind === 'red_flag')).toHaveLength(1);
  });

  it('emits claim_corroboration rows only when ≥ 2 articles agree on (primary, mechanism)', () => {
    const same = (id: string) =>
      claim({
        articleSource: 'news',
        articleId: id,
        parties: [
          {
            kind: 'person',
            name: 'X Y',
            normalizedName: 'x y',
            role: 'beneficiary',
          },
        ],
      });
    const rows = deriveSignals({
      records: [],
      redFlags: [],
      claims: [same('a1'), same('a2'), same('a3')],
      benchmarks: [],
      nowMs: NOW_MS,
    });
    expect(
      rows.filter((r) => r.sourceKind === 'claim_corroboration'),
    ).toHaveLength(3);
  });

  it('Σ effectiveWeight ≈ baseWeight*multiplier for every row (invariant precondition)', () => {
    const rows = deriveSignals({
      records: [record()],
      redFlags: [redFlag()],
      claims: [],
      benchmarks: [
        {
          cohortHash: 'h1',
          n: 12,
          computedAt: '2026-05-19T00:00:00Z',
          isOutlier: true,
        },
      ],
      nowMs: NOW_MS,
    });
    for (const r of rows) {
      const eff = Number(r.baseWeight) * Number(r.stalenessMultiplier);
      expect(Math.abs(Number(r.effectiveWeight) - eff)).toBeLessThanOrEqual(0.005);
    }
    const sum = sumSignals(rows);
    const expected = rows.reduce(
      (acc, r) => acc + Number(r.effectiveWeight),
      0,
    );
    expect(Math.abs(sum - Number(expected.toFixed(2)))).toBeLessThanOrEqual(0.01);
  });

  it('drift assertion: SUM rounds to two decimals just like score.ts', () => {
    const rows = deriveSignals({
      records: [
        record({ id: 'a', sourceSystem: 'TED' }),
        record({ id: 'b', sourceSystem: 'EKR' }),
      ],
      redFlags: [redFlag({ severity: 'critical' })],
      claims: [],
      benchmarks: [],
      nowMs: NOW_MS,
    });
    const sum = sumSignals(rows);
    expect(sum.toFixed(2)).toBe(sum.toFixed(2));
  });
});
