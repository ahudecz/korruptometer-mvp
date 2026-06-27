import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import type {
  ArticleClaimDto,
  ArticleClaimsBundle,
  ExtractionRunDto,
} from '../../../../../packages/shared/src/investigation';

/**
 * T015 — Vitest "route" test for GET /api/admin/articles/:source/:id/claims.
 *
 * The route module imports `requireEditor`, `getDb`, and `getExtractorVersion`
 * at module scope; the test mocks all three before importing the route's
 * GET handler. The fake `getDb()` exposes a thin chainable that returns
 * three result sets: the article header, the extraction runs, and the
 * latest-version probe. A separate `select().from().where().limit()` call
 * is used for the article header; a separate `select().from().where()` is
 * used for the runs; another `select().from().orderBy().limit()` for the
 * latest probe. We sequence them via a small queue.
 */
type SelectShape = unknown;
const fakeDb = {
  queue: [] as SelectShape[],
  reset() {
    this.queue.length = 0;
  },
  push(value: SelectShape) {
    this.queue.push(value);
  },
  next() {
    return this.queue.shift();
  },
};

vi.mock('@/lib/admin/auth', () => ({
  requireEditor: vi.fn(async () => ({ email: 'editor@example.com', editor: { id: 'e1' } })),
}));

vi.mock('@/lib/investigation/extractor-version', () => ({
  getExtractorVersion: () => 'claude-haiku-4-5@aaaaaaaa',
}));

vi.mock('@/lib/db', () => {
  const builder = (): unknown => ({
    select: () => builder(),
    from: () => builder(),
    where: () => builder(),
    orderBy: () => builder(),
    limit: () => {
      // limit() resolves to the next queued result set.
      const value = fakeDb.next() ?? [];
      return Promise.resolve(value);
    },
    then: (onFulfilled: (value: unknown) => unknown) => {
      // For chains that end at `.where()` or `.orderBy()` (no `.limit()`).
      const value = fakeDb.next() ?? [];
      return Promise.resolve(value).then(onFulfilled);
    },
  });
  return {
    getDb: () => builder(),
    schema: {
      newsArticles: {},
      kMonitorArticles: {},
      articleExtractionRuns: {},
      articleClaims: {},
    },
  };
});

beforeEach(() => {
  fakeDb.reset();
});

async function callGet(source: string, id: string): Promise<Response> {
  const mod = await import(
    '../../../app/api/admin/articles/[source]/[id]/claims/route'
  );
  return mod.GET(new Request(`http://localhost/api/admin/articles/${source}/${id}/claims`), {
    params: Promise.resolve({ source, id }),
  });
}

describe('GET /api/admin/articles/:source/:id/claims', () => {
  it('404s on unknown article source', async () => {
    const res = await callGet('twitter', 'abc');
    expect(res.status).toBe(404);
  });

  it('404s on missing article', async () => {
    // Article header query → empty array.
    fakeDb.push([]);
    const res = await callGet('news', 'missing-id');
    expect(res.status).toBe(404);
  });

  it('returns runs grouped by extractor version with isCurrent flagged', async () => {
    // 1) Article header.
    fakeDb.push([
      { id: 'art-1', headline: 'Cikk', sourceUrl: 'https://x/y' },
    ]);
    // 2) Runs.
    fakeDb.push([
      {
        articleSource: 'news',
        articleId: 'art-1',
        extractorVersion: 'haiku@new00001',
        claimCount: 0,
        model: 'claude-haiku-4-5',
        extractedAt: new Date('2026-05-12T11:30:00Z'),
        inputTokens: 100,
        outputTokens: 50,
        estimatedHufSpend: '0.10',
      },
      {
        articleSource: 'news',
        articleId: 'art-1',
        extractorVersion: 'haiku@old00002',
        claimCount: 2,
        model: 'claude-haiku-4-5',
        extractedAt: new Date('2026-04-30T14:02:00Z'),
        inputTokens: 100,
        outputTokens: 50,
        estimatedHufSpend: '0.10',
      },
    ]);
    // 3) Latest version probe.
    fakeDb.push([{ v: 'haiku@new00001', at: new Date('2026-05-12T11:30:00Z') }]);
    // 4) Claims.
    fakeDb.push([
      {
        id: 'c1',
        articleSource: 'news',
        articleId: 'art-1',
        claimOrdinal: 1,
        extractorVersion: 'haiku@old00002',
        mechanism: 'overpricing',
        allegedAmountHuf: 1_500_000_000n,
        amountBasis: 'stated',
        parties: [{ kind: 'person', name: 'X', normalizedName: 'x', role: 'főnök' }],
        evidenceQuote: 'kibővítették 1.5 milliárddal',
        sourceUrl: 'https://x/y',
        paragraphLocator: 'p:14',
        confidence: 80,
        createdAt: new Date(),
      },
    ]);
    const res = await callGet('news', 'art-1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ArticleClaimsBundle;
    expect(body.article.id).toBe('art-1');
    expect(body.extractionRuns).toHaveLength(2);
    const current = body.extractionRuns.find(
      (r: ExtractionRunDto) => r.extractorVersion === 'haiku@new00001',
    );
    expect(current?.isCurrent).toBe(true);
    expect(current?.claimCount).toBe(0);
    expect(current?.claims).toHaveLength(0);
    const old = body.extractionRuns.find(
      (r: ExtractionRunDto) => r.extractorVersion === 'haiku@old00002',
    );
    expect(old?.isCurrent).toBe(false);
    expect(old?.claims).toHaveLength(1);
    expect((old?.claims[0] as ArticleClaimDto).allegedAmountHuf).toBe('1500000000');
  });
});
