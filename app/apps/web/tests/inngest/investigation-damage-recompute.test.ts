import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: () => undefined,
  captureException: () => undefined,
}));
vi.mock('@/lib/db', () => ({
  getDb: () => ({}),
  schema: {
    externalRecords: {},
    redFlagChecks: {},
    investigationArticleLinks: {},
    articleClaims: {},
    benchmarks: {},
  },
}));

// Capture the config passed to inngest.createFunction so we can assert
// debounce + concurrency + events without spinning up the runtime.
type CapturedFn = {
  config: Record<string, unknown>;
  triggers: Array<{ event: string }>;
};
const captured: CapturedFn[] = [];

vi.mock('@/inngest/client', () => ({
  inngest: {
    createFunction: (
      config: Record<string, unknown>,
      triggers: Array<{ event: string }>,
    ) => {
      captured.push({ config, triggers });
      return { id: config.id as string };
    },
  },
}));

import {
  computeInputsHash,
  assembleEstimate,
  type DamageInputs,
} from '../../src/lib/investigation/damage';

const baseInputs: DamageInputs = {
  investigationId: '00000000-0000-0000-0000-000000000001',
  contracts: [
    {
      externalRecordId: 'ext-1',
      sourceSystem: 'TED',
      valueHuf: 1_000_000_000n,
      quantity: 1000,
      dimension: 'road_km',
      amendments: [],
      evidenceGrade: 'investigative_journalism',
    },
  ],
  cohorts: [
    {
      cohortHash: 'h1',
      dimension: 'road_km',
      p10: 700_000,
      p50: 850_000,
      p90: 950_000,
      n: 20,
    },
  ],
  redFlags: [],
  claims: [],
};

describe('investigation.damage-recompute (T117)', () => {
  it('(a) declares debounce + concurrency keyed on investigationId, and triggers on the four input-changed events', async () => {
    await import('../../src/inngest/functions/investigation-damage-recompute');
    const fn = captured.find(
      (f) => (f.config as { id?: string }).id === 'investigation.damage-recompute',
    );
    expect(fn).toBeDefined();
    const debounce = fn!.config.debounce as { key?: string; period?: string };
    expect(debounce.key).toBe('event.data.investigationId');
    expect(debounce.period).toBe('30s');
    const concurrency = fn!.config.concurrency as Array<{ key?: string; limit?: number }>;
    expect(concurrency[0]?.key).toBe('event.data.investigationId');
    expect(concurrency[0]?.limit).toBe(1);
    const eventNames = fn!.triggers.map((t) => t.event).sort();
    expect(eventNames).toEqual(
      [
        'investigation.benchmark.changed',
        'investigation.claim.changed',
        'investigation.external-record.changed',
        'investigation.redflag.changed',
      ].sort(),
    );
  });

  it('(b) inputsHash is identical for the same input set — the short-circuit precondition', () => {
    const a = computeInputsHash(baseInputs);
    const b = computeInputsHash({
      ...baseInputs,
      contracts: [...baseInputs.contracts],
    });
    expect(a).toBe(b);
  });

  it('(b) inputsHash changes when any input id set changes', () => {
    const a = computeInputsHash(baseInputs);
    const b = computeInputsHash({
      ...baseInputs,
      contracts: [
        {
          ...baseInputs.contracts[0]!,
          externalRecordId: 'ext-2',
        },
      ],
    });
    expect(a).not.toBe(b);
  });

  it('(c) assembled estimate totals equal Σ components — the persisted row invariant', () => {
    const out = assembleEstimate(baseInputs);
    const sumLow = out.components.reduce(
      (acc, c) => acc + BigInt(c.lowHuf),
      0n,
    );
    const sumHigh = out.components.reduce(
      (acc, c) => acc + BigInt(c.highHuf),
      0n,
    );
    expect(BigInt(out.totalLowHuf)).toBe(sumLow);
    expect(BigInt(out.totalHighHuf)).toBe(sumHigh);
  });

  it('(d) emits no overpricing component when the cohort is too thin (n<10) — lead-emit candidate', () => {
    const out = assembleEstimate({
      ...baseInputs,
      cohorts: [{ ...baseInputs.cohorts[0]!, n: 5 }],
    });
    expect(
      out.components.find((c) => c.method === 'benchmark_deviation'),
    ).toBeUndefined();
  });
});
