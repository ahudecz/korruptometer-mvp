import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../client', () => ({ inngest: { createFunction: vi.fn() } }));
vi.mock('@/lib/cron-bypass', () => ({ isBypassActive: () => false }));
vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@korr/scrapers', () => ({ fetchArticleBodyTransient: vi.fn(async () => null) }));

const telegram: string[] = [];
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: vi.fn(async (m: string) => { telegram.push(m); }) }));

const articles = [
  { id: 'a1', headline: 'Lemondott a Tolna Vármegyei Közgyűlés elnöke', excerpt: 'lemondott', publishedAt: new Date(), sourceUrl: 'https://x/1', sourceName: 'Telex' },
  { id: 'a2', headline: 'Lemondott Kecskemét alpolgármestere', excerpt: 'lemondott', publishedAt: new Date(), sourceUrl: 'https://x/2', sourceName: 'HVG' },
];
vi.mock('@korr/db', () => ({
  articleDateIso: () => '2026-10-09',
  isTransientLlmFailure: () => false,
  loadUncheckedArticles: vi.fn(async () => articles),
}));

import { runArticleDetectionBatch } from './detector-runner';

const step = {
  run: (async (_n: string, fn: () => unknown) => fn()) as never,
  sendEvent: (async () => null) as never,
};

describe('runArticleDetectionBatch — egy hibás cikk nem állíthatja meg a köteget (2026-10-09)', () => {
  beforeEach(() => { telegram.length = 0; });

  it('a hibás cikk után a következő is feldolgozódik, és Telegram-jelzés megy', async () => {
    const processed: string[] = [];
    const res = await runArticleDetectionBatch({
      step,
      detectorType: 'resignation' as never,
      keywords: ['lemond'],
      callLlm: async () => ({ data: { ok: true }, inputTokens: 1, outputTokens: 1 }) as never,
      isIncomplete: () => false,
      processArticle: async (a: { id: string }) => {
        if (a.id === 'a1') throw new Error('The "string" argument must be of type string … Received an instance of Date');
        processed.push(a.id);
        return { inserted: true, approved: false };
      },
      logLabel: 'resignation.detect',
    } as never);

    expect(processed).toEqual(['a2']);
    expect(res.inserted).toBe(1);
    expect(telegram).toHaveLength(1);
    expect(telegram[0]).toContain('1 cikk feldolgozása hibával elszállt');
    expect(telegram[0]).toContain('Tolna');
  });

  it('hiba nélkül nem küld jelzést', async () => {
    await runArticleDetectionBatch({
      step,
      detectorType: 'resignation' as never,
      keywords: ['lemond'],
      callLlm: async () => ({ data: { ok: true }, inputTokens: 1, outputTokens: 1 }) as never,
      isIncomplete: () => false,
      processArticle: async () => ({ inserted: false, approved: false }),
      logLabel: 'resignation.detect',
    } as never);
    expect(telegram).toHaveLength(0);
  });
});
