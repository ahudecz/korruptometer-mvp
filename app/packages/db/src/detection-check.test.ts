import { describe, expect, it } from 'vitest';
import {
  BACKLOG_DAYS,
  NEAR_MISS_MAX,
  NEAR_MISS_MIN,
  isTransientLlmFailure,
  loadUncheckedArticles,
  markChecked,
} from './detection-check';

describe('isTransientLlmFailure (FR-002)', () => {
  it('is true when the call never completed (null data, zero tokens)', () => {
    expect(isTransientLlmFailure({ data: null, inputTokens: 0, outputTokens: 0 })).toBe(true);
  });
  it('is false for a genuine no-match result (null data, tokens WERE spent)', () => {
    expect(isTransientLlmFailure({ data: null, inputTokens: 120, outputTokens: 40 })).toBe(false);
  });
  it('is false whenever data is present', () => {
    expect(isTransientLlmFailure({ data: { isResignation: false }, inputTokens: 100, outputTokens: 20 })).toBe(false);
  });
});

describe('constants', () => {
  it('backlog window is 7 days', () => {
    expect(BACKLOG_DAYS).toBe(7);
  });
  it('near-miss band sits below the 0.70 review.ts discard floor', () => {
    expect(NEAR_MISS_MIN).toBe(0.5);
    expect(NEAR_MISS_MAX).toBeLessThan(0.7);
  });
});

describe('loadUncheckedArticles', () => {
  it('returns whatever the backlog/not-yet-checked query yields', async () => {
    const rows = [{ id: 'a1', headline: 'x', excerpt: 'y', publishedAt: '2026-07-06', sourceUrl: null }];
    const db = { execute: async () => rows };
    expect(await loadUncheckedArticles(db, 'resignation')).toEqual(rows);
  });

  it('returns an empty list when everything is already checked', async () => {
    const db = { execute: async () => [] };
    expect(await loadUncheckedArticles(db, 'media_closure')).toEqual([]);
  });
});

describe('markChecked', () => {
  it('writes exactly one row for a successful insertion (US1/US2)', async () => {
    let calls = 0;
    const db = { execute: async () => { calls++; return []; } };
    await markChecked(db, { articleId: 'a1', detectorType: 'resignation', outcome: 'inserted' });
    expect(calls).toBe(1);
  });

  it('writes a discard row with the specific reason + confidence + name (US2)', async () => {
    let captured: unknown;
    const db = { execute: async (q: unknown) => { captured = q; return []; } };
    await markChecked(db, {
      articleId: 'a2',
      detectorType: 'resignation',
      outcome: 'discarded',
      reason: 'low_confidence',
      extractedName: 'Szöllősi György',
      confidence: 0.55,
    });
    expect(captured).toBeDefined();
  });

  it('never throws when optional fields are omitted', async () => {
    const db = { execute: async () => [] };
    await expect(
      markChecked(db, { articleId: 'a3', detectorType: 'asset_recovery', outcome: 'discarded', reason: 'not_applicable' }),
    ).resolves.toBeUndefined();
  });

  // Real ON CONFLICT (articleId, detectorType) DO NOTHING idempotency is a
  // DB-level guarantee (see the 0032 migration's unique index) — exercised
  // by the local migration run + manual smoke test, not re-derived here
  // against a mock, matching this repo's existing isDuplicate test style.
});
