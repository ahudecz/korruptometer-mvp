import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

type Article = {
  id: string;
  headline: string;
  excerpt: string;
  linkOverridden: boolean;
};

type CaseRow = { id: string; name: string; position: string };

type FakeUpdate = { id: string; relatedCaseId?: string; linkConfidence?: number };

const state = {
  articles: [] as Article[],
  cases: [] as CaseRow[],
  updates: [] as FakeUpdate[],
  currentArticleId: null as string | null,
  lastQueryArgs: [] as unknown[],
};

vi.mock('@/lib/db', () => {
  return {
    getDb: () => ({
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(state.articles.map((a) => ({ ...a }))),
        }),
      }),
      execute: async (q: { values?: unknown[] }) => {
        // The aggregator passes the article text as a sql parameter; pick it
        // out of the last template's values array.
        const text = q?.values?.find((v) => typeof v === 'string') as string | undefined;
        let best: { id: string; score: number } = { id: '', score: 0 };
        for (const c of state.cases) {
          const score = jaccard(`${c.name} ${c.position}`, text ?? '');
          if (score > best.score) best = { id: c.id, score };
        }
        return [best];
      },
      update: () => ({
        set: (patch: { relatedCaseId?: string; linkConfidence?: number }) => ({
          where: () => {
            if (state.currentArticleId) {
              state.updates.push({ id: state.currentArticleId, ...patch });
            }
            return Promise.resolve();
          },
        }),
      }),
    }),
    schema: {
      newsArticles: {
        id: 'id',
        headline: 'headline',
        excerpt: 'excerpt',
        linkOverridden: 'linkOverridden',
      },
    },
  };
});

vi.mock('drizzle-orm', () => {
  return {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
      state.lastQueryArgs = values;
      return { strings, values, toString: () => strings.join('?') };
    },
    inArray: (_col: unknown, ids: string[]) => ({ inArray: ids }),
  };
});

vi.mock('../client', () => {
  return {
    inngest: {
      createFunction: (_cfg: unknown, _trig: unknown, handler: unknown) => ({ handler }),
    },
  };
});

function jaccard(a: string, b: string): number {
  const A = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const B = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((t) => B.has(t) && (inter += 1));
  return inter / (A.size + B.size - inter);
}

async function runAggregator(opts: { auto: number; review: number; ids: string[] }) {
  process.env.LINK_AUTO_THRESHOLD = String(opts.auto);
  process.env.LINK_REVIEW_THRESHOLD = String(opts.review);
  const mod = await import('./aggregate-link-articles');
  const fn = mod.aggregateLinkArticles as unknown as {
    handler: (ctx: {
      event: { data: { articleIds: string[] } };
      step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> };
    }) => Promise<unknown>;
  };
  await fn.handler({
    event: { data: { articleIds: opts.ids } },
    step: {
      run: async (name, f) => {
        if (name.startsWith('link-')) state.currentArticleId = name.slice('link-'.length);
        const out = await f();
        state.currentArticleId = null;
        return out;
      },
    },
  });
}

beforeEach(() => {
  vi.resetModules();
  state.articles = [];
  state.cases = [];
  state.updates = [];
  state.currentArticleId = null;
});

describe('aggregate.link-articles', () => {
  it('auto-links when score ≥ auto threshold (T154 above-threshold)', async () => {
    state.articles = [
      { id: 'a1', headline: 'Kovács János polgármester', excerpt: 'Korrupció vád', linkOverridden: false },
    ];
    state.cases = [{ id: 'C-1', name: 'Kovács János', position: 'polgármester' }];
    await runAggregator({ auto: 0.5, review: 0.3, ids: ['a1'] });
    const upd = state.updates.find((u) => u.id === 'a1');
    expect(upd?.relatedCaseId).toBe('C-1');
    expect(upd?.linkConfidence).toBeGreaterThanOrEqual(50);
  });

  it('records confidence only when between thresholds (T154 between)', async () => {
    state.articles = [
      { id: 'a2', headline: 'Valami történt ma', excerpt: 'Kovács', linkOverridden: false },
    ];
    state.cases = [{ id: 'C-1', name: 'Kovács János', position: 'polgármester' }];
    await runAggregator({ auto: 0.6, review: 0.1, ids: ['a2'] });
    const upd = state.updates.find((u) => u.id === 'a2');
    expect(upd?.relatedCaseId).toBeUndefined();
    expect(upd?.linkConfidence).toBeGreaterThan(0);
  });

  it('skips rows where linkOverridden=true (T155 override)', async () => {
    state.articles = [
      { id: 'a3', headline: 'Kovács János polgármester', excerpt: 'Korrupció', linkOverridden: true },
    ];
    state.cases = [{ id: 'C-1', name: 'Kovács János', position: 'polgármester' }];
    await runAggregator({ auto: 0.5, review: 0.3, ids: ['a3'] });
    expect(state.updates.find((u) => u.id === 'a3')).toBeUndefined();
  });
});
