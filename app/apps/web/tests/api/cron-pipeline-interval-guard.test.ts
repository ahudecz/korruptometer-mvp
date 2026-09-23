import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * A 20 perces szünet-kapu (l. app/api/cron/pipeline/route.ts).
 *
 * Miért van rá teszt: a kapu az, ami lehetővé teszi, hogy több, egymástól
 * független indító (két GitHub-workflow, plusz esetleg külső cron) biztonsággal
 * üsse ugyanazt a végpontot. Ha ez elromlik, két egyszerre érkező indítás
 * ugyanazt az új cikket kétszer fizetné ki az AI-nál — pont az a költség-hiba,
 * amit a gyakoribb futásnál el akarunk kerülni.
 */

// Mikor futott utoljára a scrape — a teszt ezt állítgatja.
let lastScrapedAt: Date | null = null;

/**
 * A `next/server` `after()`-je valódi kérés-hatókört igényel, ami unit-tesztben
 * nincs. Itt elkapjuk a visszahívást, hogy két dolgot külön tudjunk
 * ellenőrizni: (1) a válasz AZONNAL megy, munkavégzés nélkül, és (2) a munka
 * attól még be van ütemezve, nem veszett el.
 */
const afterCallbacks: Array<() => unknown> = [];
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: (fn: () => unknown) => { afterCallbacks.push(fn); } };
});

vi.mock('@/lib/db', () => ({
  schema: { sources: { enabled: 'enabled', lastScrapedAt: 'lastScrapedAt' } },
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: async () => [{ last: lastScrapedAt }],
      }),
    }),
  }),
}));

const runScrapeNewsCore = vi.fn(async () => ({ sources: 0, newArticles: 0 }));
const noop = vi.fn(async () => ({}));

vi.mock('@/inngest/functions/scrape-news', () => ({ runScrapeNewsCore }));
vi.mock('@/inngest/functions/detect-resignations', () => ({ runResignationDetectionCore: noop }));
vi.mock('@/inngest/functions/detect-verdicts', () => ({ runVerdictDetectionCore: noop }));
vi.mock('@/inngest/functions/detect-media-closures', () => ({ runMediaClosureDetectionCore: noop }));
vi.mock('@/inngest/functions/detect-asset-recoveries', () => ({ runAssetRecoveryDetectionCore: noop }));
vi.mock('@/inngest/functions/detect-criminal-complaints', () => ({ runCriminalComplaintDetectionCore: noop }));
vi.mock('@/inngest/functions/detect-watchlist-removals', () => ({ runWatchlistRemovalDetectionCore: noop }));
vi.mock('@/inngest/functions/check-custody-expiry', () => ({ runCustodyExpiryCheckCore: noop }));

const CRON_SECRET = 'test-cron-secret';

async function call(query = ''): Promise<Response> {
  const mod = await import('../../app/api/cron/pipeline/route');
  return mod.GET(
    new Request(`http://localhost/api/cron/pipeline${query}`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    }),
  );
}

beforeAll(async () => {
  await import('../../app/api/cron/pipeline/route');
}, 60_000);

beforeEach(() => {
  runScrapeNewsCore.mockClear();
  noop.mockClear();
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.PIPELINE_BYPASS_INNGEST = '1';
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.PIPELINE_BYPASS_INNGEST;
  lastScrapedAt = null;
  afterCallbacks.length = 0;
});

describe('GET /api/cron/pipeline — 20 perces szünet-kapu', () => {
  it('lefut, ha még sosem futott', async () => {
    lastScrapedAt = null;
    const res = await call();
    expect(await res.json()).not.toHaveProperty('skipped', 'ran_recently');
    expect(runScrapeNewsCore).toHaveBeenCalledTimes(1);
  });

  it('lefut, ha az előző futás régebbi 20 percnél', async () => {
    lastScrapedAt = new Date(Date.now() - 45 * 60_000);
    const res = await call();
    expect(await res.json()).not.toHaveProperty('skipped', 'ran_recently');
    expect(runScrapeNewsCore).toHaveBeenCalledTimes(1);
  });

  it('KIHAGYJA, ha az előző futás 20 percnél frissebb — nulla munkavégzés', async () => {
    lastScrapedAt = new Date(Date.now() - 5 * 60_000);
    const res = await call();
    const body = await res.json();
    expect(body.skipped).toBe('ran_recently');
    expect(body.elapsedMinutes).toBe(5);
    // Ez a lényeg: egyetlen fizetős lépés sem indult el.
    expect(runScrapeNewsCore).not.toHaveBeenCalled();
    expect(noop).not.toHaveBeenCalled();
  });

  it('a ?force=1 átviszi a kapun (kézi futtatás)', async () => {
    lastScrapedAt = new Date(Date.now() - 1 * 60_000);
    await call('?force=1');
    expect(runScrapeNewsCore).toHaveBeenCalledTimes(1);
  });

  it('az ?async=1 azonnal 202-t ad — a hívó nem vár a munkára, de a munka elindul', async () => {
    lastScrapedAt = new Date(Date.now() - 60 * 60_000);
    const res = await call('?async=1');

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ started: true, mode: 'async' });
    // A válasz pillanatában MÉG nem futott le semmi — ez a lényege.
    expect(runScrapeNewsCore).not.toHaveBeenCalled();

    // De be van ütemezve, és le is fut.
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]!();
    expect(runScrapeNewsCore).toHaveBeenCalledTimes(1);
  });

  it('az ?async=1 sem ugorja át a szünet-kaput', async () => {
    lastScrapedAt = new Date(Date.now() - 2 * 60_000);
    const res = await call('?async=1');
    expect((await res.json()).skipped).toBe('ran_recently');
    expect(runScrapeNewsCore).not.toHaveBeenCalled();
  });

  it('a kapu NEM írja felül az auth-ot: rossz titokkal 401, akkor is ha rég futott', async () => {
    lastScrapedAt = new Date(Date.now() - 10 * 60_000);
    const mod = await import('../../app/api/cron/pipeline/route');
    const res = await mod.GET(
      new Request('http://localhost/api/cron/pipeline', { headers: { authorization: 'Bearer nope' } }),
    );
    expect(res.status).toBe(401);
    expect(runScrapeNewsCore).not.toHaveBeenCalled();
  });
});
