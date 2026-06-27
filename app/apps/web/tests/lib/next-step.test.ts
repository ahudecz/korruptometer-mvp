import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { pickNextStep } from '../../src/lib/investigation/next-step';
import type {
  AvailableAction,
  InvestigationJobStateDto,
} from '@korr/shared';

const NOW_MS = new Date('2026-05-19T12:00:00Z').getTime();

function jobState(
  overrides: Partial<InvestigationJobStateDto>,
): InvestigationJobStateDto {
  return {
    jobKind: 'xref',
    state: 'idle',
    startedAt: null,
    finishedAt: null,
    inngestRunId: null,
    summary: null,
    errorMessage: null,
    updatedAt: '2026-05-19T00:00:00Z',
    ...overrides,
  };
}

describe('pickNextStep priority order (T126, FR-055)', () => {
  it('returns null when nothing applies', () => {
    expect(
      pickNextStep({
        jobStates: [],
        newestExternalRecordFetchedAt: '2026-05-18T00:00:00Z',
        hasExternalRecords: true,
        hasRedFlags: true,
        availableActions: [] as AvailableAction[],
        nowMs: NOW_MS,
      }),
    ).toBeNull();
  });

  it('1. job_failed beats every lower-priority banner', () => {
    const banner = pickNextStep({
      jobStates: [
        jobState({
          jobKind: 'xref',
          state: 'failed',
          errorMessage: 'TED API időtúllépés.',
        }),
      ],
      newestExternalRecordFetchedAt: null,
      hasExternalRecords: false,
      hasRedFlags: false,
      availableActions: ['promote_journalist'] as AvailableAction[],
      nowMs: NOW_MS,
    });
    expect(banner?.kind).toBe('job_failed');
  });

  it('2. stale_external_record fires when newest record > 365 days old', () => {
    const banner = pickNextStep({
      jobStates: [],
      newestExternalRecordFetchedAt: '2024-04-01T00:00:00Z',
      hasExternalRecords: true,
      hasRedFlags: true,
      availableActions: [] as AvailableAction[],
      nowMs: NOW_MS,
    });
    expect(banner?.kind).toBe('stale_external_record');
  });

  it('3. missing_xref when no records exist (and no failed job)', () => {
    const banner = pickNextStep({
      jobStates: [],
      newestExternalRecordFetchedAt: null,
      hasExternalRecords: false,
      hasRedFlags: false,
      availableActions: [] as AvailableAction[],
      nowMs: NOW_MS,
    });
    expect(banner?.kind).toBe('missing_xref');
  });

  it('4. missing_redflags when records exist but red flags do not', () => {
    const banner = pickNextStep({
      jobStates: [],
      newestExternalRecordFetchedAt: '2026-05-18T00:00:00Z',
      hasExternalRecords: true,
      hasRedFlags: false,
      availableActions: [] as AvailableAction[],
      nowMs: NOW_MS,
    });
    expect(banner?.kind).toBe('missing_redflags');
  });

  it('5. predicate_newly_passes when a promotion action becomes available', () => {
    const banner = pickNextStep({
      jobStates: [],
      newestExternalRecordFetchedAt: '2026-05-18T00:00:00Z',
      hasExternalRecords: true,
      hasRedFlags: true,
      availableActions: ['promote_journalist'] as AvailableAction[],
      nowMs: NOW_MS,
    });
    expect(banner?.kind).toBe('predicate_newly_passes');
  });

  it('returns at most ONE banner across 30 fixture states (SC-019)', () => {
    const fixtures: Array<Parameters<typeof pickNextStep>[0]> = [];
    // 10 happy paths (varying tier promotions available)
    for (let i = 0; i < 10; i += 1) {
      fixtures.push({
        jobStates: [],
        newestExternalRecordFetchedAt: '2026-05-18T00:00:00Z',
        hasExternalRecords: true,
        hasRedFlags: true,
        availableActions: i % 3 === 0 ? ['promote_journalist'] : [],
        nowMs: NOW_MS,
      });
    }
    // 10 failed-job permutations
    const kinds: InvestigationJobStateDto['jobKind'][] = [
      'xref',
      'redflags',
      'hypothesis_loop',
      'benchmarks',
      'damage_recompute',
    ];
    for (let i = 0; i < 10; i += 1) {
      fixtures.push({
        jobStates: [
          jobState({
            jobKind: kinds[i % kinds.length]!,
            state: 'failed',
            errorMessage: 'x',
          }),
        ],
        newestExternalRecordFetchedAt: '2026-05-18T00:00:00Z',
        hasExternalRecords: true,
        hasRedFlags: true,
        availableActions: [],
        nowMs: NOW_MS,
      });
    }
    // 10 stale/missing permutations
    for (let i = 0; i < 10; i += 1) {
      fixtures.push({
        jobStates: [],
        newestExternalRecordFetchedAt: '2023-01-01T00:00:00Z',
        hasExternalRecords: i % 2 === 0,
        hasRedFlags: i % 3 === 0,
        availableActions: [],
        nowMs: NOW_MS,
      });
    }
    let count = 0;
    for (const s of fixtures) {
      const b = pickNextStep(s);
      if (b) count += 1;
      // Always returns 0 or 1 banner — never an array.
      expect(b === null || typeof b === 'object').toBe(true);
    }
    expect(count).toBeGreaterThan(0);
    expect(fixtures.length).toBe(30);
  });
});
