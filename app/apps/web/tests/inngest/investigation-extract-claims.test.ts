import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  computeExtractorVersion,
  getExtractorVersion,
} from '../../src/lib/investigation/extractor-version';

describe('extractor-version (T013)', () => {
  beforeEach(() => {
    delete process.env.INVESTIGATION_EXTRACTOR_MODEL;
    delete process.env.INVESTIGATION_EXTRACTOR_PROMPT_VERSION;
  });

  it('produces a deterministic `{model}@{hash8}` string', () => {
    process.env.INVESTIGATION_EXTRACTOR_MODEL = 'claude-haiku-4-5';
    process.env.INVESTIGATION_EXTRACTOR_PROMPT_VERSION = 'v1';
    const a = computeExtractorVersion();
    const b = computeExtractorVersion();
    expect(a).toBe(b);
    expect(a.startsWith('claude-haiku-4-5@')).toBe(true);
    expect(a.split('@')[1]).toHaveLength(8);
  });

  it('changes when the prompt version env var changes', () => {
    process.env.INVESTIGATION_EXTRACTOR_MODEL = 'claude-haiku-4-5';
    process.env.INVESTIGATION_EXTRACTOR_PROMPT_VERSION = 'v1';
    const v1 = computeExtractorVersion();
    process.env.INVESTIGATION_EXTRACTOR_PROMPT_VERSION = 'v2';
    const v2 = computeExtractorVersion();
    expect(v1).not.toBe(v2);
  });

  it('caches via getExtractorVersion within the same module load', () => {
    process.env.INVESTIGATION_EXTRACTOR_MODEL = 'claude-haiku-4-5';
    process.env.INVESTIGATION_EXTRACTOR_PROMPT_VERSION = 'v1';
    const a = getExtractorVersion();
    process.env.INVESTIGATION_EXTRACTOR_PROMPT_VERSION = 'v9';
    const b = getExtractorVersion();
    expect(a).toBe(b);
  });
});

describe('llm-spend kill switch (T013)', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.LLM_DAILY_CEILING_HUF;
    delete process.env.HAIKU_HUF_INPUT_PER_M;
    delete process.env.HAIKU_HUF_OUTPUT_PER_M;
  });

  it('marks paused when DailyLlmUsage.estimatedHufSpend meets the ceiling', async () => {
    process.env.LLM_DAILY_CEILING_HUF = '100';
    const { probeDailySpend } = await import(
      '../../src/lib/investigation/llm-spend'
    );
    const tx = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([{ current: '120' }] as unknown),
    } as unknown as Parameters<typeof probeDailySpend>[0];
    const probe = await probeDailySpend(tx, 'claude-haiku-4-5');
    expect(probe).toEqual({
      paused: true,
      currentSpendHuf: '120',
      ceilingHuf: '100',
    });
  });

  it('marks NOT paused when row is missing (first call of the day)', async () => {
    process.env.LLM_DAILY_CEILING_HUF = '100';
    const { probeDailySpend } = await import(
      '../../src/lib/investigation/llm-spend'
    );
    const tx = {
      execute: vi.fn().mockResolvedValueOnce([] as unknown),
    } as unknown as Parameters<typeof probeDailySpend>[0];
    const probe = await probeDailySpend(tx, 'claude-haiku-4-5');
    expect(probe.paused).toBe(false);
    expect(probe.currentSpendHuf).toBe('0');
  });

  it('estimateHufSpend reflects per-million pricing env overrides', async () => {
    process.env.HAIKU_HUF_INPUT_PER_M = '1000';
    process.env.HAIKU_HUF_OUTPUT_PER_M = '2000';
    const { estimateHufSpend } = await import(
      '../../src/lib/investigation/llm-spend'
    );
    // 1M input + 1M output → 1000 + 2000 = 3000 HUF
    expect(estimateHufSpend(1_000_000, 1_000_000)).toBe('3000.00');
  });
});
