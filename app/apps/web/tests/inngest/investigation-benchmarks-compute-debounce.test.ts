import { describe, expect, it, vi } from 'vitest';

// Verifies the Inngest function config directly (same technique as
// investigation-damage-recompute.test.ts) rather than exercising the run
// body — debounce/concurrency are declarative SDK config, not runtime
// behavior a unit test can otherwise observe.

vi.mock('server-only', () => ({}));
vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: () => undefined,
  captureException: () => undefined,
}));
vi.mock('@/lib/db', () => ({
  getDb: () => ({}),
}));
vi.mock('@/lib/investigation/benchmarks', () => ({
  DIMENSIONS: [],
  cohortHash: () => 'h',
  computeCohort: async () => null,
  specForDimension: () => ({}),
}));
vi.mock('@/lib/investigation/job-state', () => ({
  startJob: async () => undefined,
  completeJob: async () => undefined,
  failJob: async () => undefined,
}));

type CapturedFn = {
  config: Record<string, unknown>;
  trigger: { event: string };
};
const captured: CapturedFn[] = [];

vi.mock('@/inngest/client', () => ({
  inngest: {
    createFunction: (config: Record<string, unknown>, trigger: { event: string }) => {
      captured.push({ config, trigger });
      return { id: config.id as string };
    },
  },
}));

describe('investigation.benchmarks-compute (2026-08-07 quota fix)', () => {
  it('debounces per investigationId — xref fans this out ~13x/run (one per adapter), previously undebounced and the single largest Inngest execution consumer (1,300/24h measured)', async () => {
    await import('../../src/inngest/functions/investigation-benchmarks-compute');
    const fn = captured.find((f) => (f.config as { id?: string }).id === 'investigation.benchmarks-compute');
    expect(fn).toBeDefined();
    const debounce = fn!.config.debounce as { key?: string; period?: string };
    expect(debounce.key).toBe('event.data.investigationId');
    expect(debounce.period).toBe('30s');
    const concurrency = fn!.config.concurrency as Array<{ key?: string; limit?: number }>;
    expect(concurrency[0]?.key).toBe('event.data.investigationId');
    expect(concurrency[0]?.limit).toBe(1);
    expect(fn!.trigger.event).toBe('investigation.xref.source.completed');
  });
});
