import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../client', () => ({ inngest: { createFunction: vi.fn() } }));
vi.mock('@/lib/cron-bypass', () => ({ isBypassActive: () => false }));
vi.mock('@/lib/ai-classify', () => ({ classifyArticle: vi.fn() }));
vi.mock('@/lib/breaking-monitored', () => ({ getMonitoredNames: vi.fn(async () => ['Lázár János']) }));

const breakingTitles = new Set(['Letartóztatták Lázár Jánost']);
vi.mock('@korr/scrapers', () => ({ isBreaking: (title: string) => breakingTitles.has(title) }));

const notifyAuto = vi.fn(async () => undefined);
const notifyReview = vi.fn(async () => undefined);
vi.mock('@/lib/notify', () => ({
  notifyPodcastBreakingAutoPublished: (...a: unknown[]) => notifyAuto(...(a as [])),
  notifyPodcastReviewNeeded: (...a: unknown[]) => notifyReview(...(a as [])),
}));

vi.mock('@app/_home/podcast-channels-config', () => ({
  PODCAST_CHANNELS: [{ slug: 'atv', name: 'ATV', handle: '@atv', viewThreshold: 5000 }],
}));

let channelVideos: Array<{ videoId: string; title: string; description: string; publishedAt: Date }> = [];
vi.mock('@/lib/youtube-podcast-sync', () => ({
  resolveUploadsPlaylistId: vi.fn(async () => 'UU123'),
  fetchChannelVideos: vi.fn(async () => channelVideos),
  fetchViewCounts: vi.fn(async () => new Map()),
  classifyVideoTier: () => 'in',
}));

const inserts: Array<Record<string, unknown>> = [];
vi.mock('@/lib/db', () => ({
  schema: { podcastVideos: { videoId: 'videoId', id: 'id' } },
  getDb: () => ({
    select: () => ({ from: () => Object.assign(Promise.resolve([]), { where: async () => [] }) }),
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        inserts.push(row);
        return { onConflictDoNothing: () => ({ returning: async () => [{ id: `row-${inserts.length}` }] }) };
      },
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  }),
}));

import { runYoutubeScrapeCore } from './scrape-youtube';

const step = { run: (async (_n: string, fn: () => unknown) => fn()) as never, sendEvent: (async () => null) as never };

describe('scrape-youtube: küszöb alatti breaking podcast (2026-10-01)', () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = 'test';
    inserts.length = 0;
    notifyAuto.mockClear();
    notifyReview.mockClear();
  });

  it('jóváhagyás nélkül, azonnal kikerül, és a Telegram csak tájékoztat', async () => {
    channelVideos = [{ videoId: 'vid1', title: 'Letartóztatták Lázár Jánost', description: '', publishedAt: new Date() }];
    const res = await runYoutubeScrapeCore({ step });

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ videoId: 'vid1', reviewStatus: 'approved', viewThresholdMet: true });
    expect(notifyAuto).toHaveBeenCalledTimes(1);
    expect(notifyReview).not.toHaveBeenCalled();
    expect(res).toMatchObject({ breakingNotified: 1 });
  });

  it('a küszöb alatti, NEM breaking videó továbbra is a küszöbre vár, értesítés nélkül', async () => {
    channelVideos = [{ videoId: 'vid2', title: 'Heti összefoglaló', description: '', publishedAt: new Date() }];
    await runYoutubeScrapeCore({ step });

    expect(inserts[0]).toMatchObject({ videoId: 'vid2', reviewStatus: 'approved', viewThresholdMet: false });
    expect(notifyAuto).not.toHaveBeenCalled();
  });
});
