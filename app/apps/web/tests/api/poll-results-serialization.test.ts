import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Élő teszttel derült ki (2026-08-31): a natív JSON.stringify nem tud
// bigint-et szerializálni, és a GET /api/poll route az `amountHuf` bigint
// mezőt közvetlenül a `NextResponse.json()`-nak adta át — ez minden
// kérésnél 500-as hibát okozott, amíg élesben ki nem próbáltuk.
vi.mock('@/lib/db', () => ({ getDb: vi.fn(() => ({})) }));

// `unstable_cache` a valódi Next.js request-lifecycle-t igényli (nincs a
// vitest-ben futtatott route-hívásnál) — a teszthez a wrapper nélküli
// eredeti függvényt adjuk vissza, hogy csak a szerializációs logikát vizsgáljuk.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('@/lib/poll-queries', () => ({
  getPollWithResults: vi.fn(async () => ({
    question: {
      id: 'q-1',
      slug: 'nvvh-elso-5-ugye',
      questionText: 'Kérdés?',
      minSelect: 1,
      maxSelect: 5,
      status: 'open' as const,
    },
    totalVotes: 1,
    options: [
      {
        id: 'opt-1',
        title: 'Ügy nagy összeggel',
        shortDescription: '',
        longDescription: null,
        amountHuf: 1_311_000_000_000n, // bigint — ez okozta a hibát
        amountLabel: null,
        sourceUrl: 'https://x',
        sourceOutlet: 'X',
        isAreaNotCase: false,
        touchesEuFunds: false,
        alreadyReported: false,
        votes: 1,
        sharePct: 100,
      },
    ],
  })),
}));

describe('GET /api/poll — bigint serialization (regression)', () => {
  it('returns 200 with the bigint amount converted to a string, not a 500', async () => {
    const mod = await import('../../app/api/poll/route');
    const res = await mod.GET(new Request('http://localhost/api/poll'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { options: Array<{ amountHuf: unknown }> };
    expect(body.options[0]!.amountHuf).toBe('1311000000000');
    expect(typeof body.options[0]!.amountHuf).toBe('string');
  });
});
