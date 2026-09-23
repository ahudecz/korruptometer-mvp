import { NextResponse, after } from 'next/server';
import { eq, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { bypassLogger, isBypassActive, makeBypassStep, verifyCronRequest } from '@/lib/cron-bypass';
import { runScrapeNewsCore } from '@/inngest/functions/scrape-news';
import { runResignationDetectionCore } from '@/inngest/functions/detect-resignations';
import { runVerdictDetectionCore } from '@/inngest/functions/detect-verdicts';
import { runMediaClosureDetectionCore } from '@/inngest/functions/detect-media-closures';
import { runAssetRecoveryDetectionCore } from '@/inngest/functions/detect-asset-recoveries';
import { runCriminalComplaintDetectionCore } from '@/inngest/functions/detect-criminal-complaints';
import { runWatchlistRemovalDetectionCore } from '@/inngest/functions/detect-watchlist-removals';
import { runCustodyExpiryCheckCore } from '@/inngest/functions/check-custody-expiry';

/**
 * 2026-07-22 — Inngest-bypass, l. cron-bypass.ts fejléce. Vercel natív
 * Cron hívja óránként (vercel.json), amíg PIPELINE_BYPASS_INNGEST=1 él
 * (az Inngest-fiók kvótája miatt, user szerint augusztus 1-ig).
 *
 * Sorrend számít: scrape-news előbb fut (új cikkek beillesztése), utána
 * a 6 detektor (loadUncheckedArticles a frissen beillesztett cikkeket is
 * látja már). Minden lépés saját try/catch-ben — egy detektor hibája nem
 * akasztja meg a többit, ugyanaz az elv, mint az Inngest step-enkénti
 * izolációja.
 *
 * 2026-07-23 — detect-watchlist-removals utólag pótolva: az eredeti
 * bypass-kör kihagyta (natív Inngest cronja 6 óránként fut, nem óránként),
 * és emiatt egy IDE nem tartozó, védtelen versenytárs maradt a közös napi
 * LLM-kereten — az Inngest ugyanis a kvótaprobléma ELLENÉRE is időnként
 * kézbesít feladatokat, és ez a detektor emiatt éjjelente jóval a
 * scrape-news/detektorok előtt felélte a napi $0.50-ot. Most már itt fut,
 * a többivel egy kalap alatt, a natív Inngest oldala pedig no-op ugyanúgy,
 * mint a másik 6-nál.
 *
 * NEM fut le itt (ismert, elfogadott korlátozás a bypass ideje alatt):
 * aggregate.link-articles / investigation.article.ingested fan-out (a
 * step.sendEvent no-op a bypass alatt, l. cron-bypass.ts) — az Investigation-
 * klaszterezés és a claim-extraction szünetel, amíg az Inngest vissza nem áll.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Két egymáshoz túl közeli indítás közti minimális szünet, percben.
 *
 * 2026-09-23 — mért probléma: a GitHub Actions ütemezője NEM tartja be az
 * óránkénti ütemezést, a pipeline a valóságban 3-5 óránként futott (16 napon
 * át napi 5-7 futás a 24 helyett). Emiatt egy friss hír órákig nem jelent
 * meg az oldalon. A megoldás több, egymástól független indító — de akkor
 * kettő könnyen egyszerre érkezhet, és ugyanazt az új cikket MINDKETTŐ
 * kifizetné az AI-nál, mielőtt a másik beszúrása látszana.
 *
 * Ez a kapu zárja ki ezt: ha az előző futás 20 percnél frissebb, a hívás
 * azonnal, munkavégzés nélkül visszatér. A redundáns indítók így ingyenesek,
 * és nyugodtan lehet belőlük több is.
 */
const MIN_INTERVAL_MINUTES = 20;

/** Mikor futott utoljára a scrape — a Source-táblából, extra tábla nélkül. */
async function lastPipelineRunAt(): Promise<Date | null> {
  const rows = await getDb()
    .select({ last: sql<Date | null>`max("lastScrapedAt")` })
    .from(schema.sources)
    .where(eq(schema.sources.enabled, true));
  return rows[0]?.last ? new Date(rows[0].last) : null;
}

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isBypassActive()) {
    return NextResponse.json({ skipped: 'bypass_not_active' });
  }

  const params = new URL(req.url).searchParams;
  // `?force=1` — kézi futtatáshoz (workflow_dispatch, hibakeresés), ilyenkor
  // a szünet-kaput szándékosan átugorjuk.
  const force = params.get('force') === '1';
  /**
   * `?async=1` — azonnali 202-es válasz, a munka a válasz UTÁN fut le
   * (Next.js `after()`).
   *
   * 2026-09-23, mért korlát: a cron-job.org ingyenes csomagja legfeljebb
   * 30 MÁSODPERCES időtúllépést enged, a teljes pipeline viszont ~60 mp
   * (mérve). Szinkron válasszal tehát minden futás „hibásnak" látszana
   * nála — és a szolgáltatás a sorozatos hibák után KIKAPCSOLJA a
   * feladatot, vagyis pont az állna le, amit épp megbízhatóvá akarunk tenni.
   *
   * Az ütemezőt nem érdekli az eredmény, csak az, hogy elindult-e; a valódi
   * visszajelzés úgyis a Telegram és az adatbázis. A GitHub-workflow-k
   * ellenben szinkronban maradnak (nincs `async` paraméterük), mert ott a
   * 280 mp-es curl-időkeret elbírja, és a futás eredménye látszik a logban.
   */
  const asyncMode = params.get('async') === '1';
  if (!force) {
    const last = await lastPipelineRunAt();
    const elapsedMin = last ? (Date.now() - last.getTime()) / 60_000 : Infinity;
    if (elapsedMin < MIN_INTERVAL_MINUTES) {
      return NextResponse.json(
        { skipped: 'ran_recently', lastRunAt: last?.toISOString() ?? null, elapsedMinutes: Math.round(elapsedMin) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  const steps: Array<[string, () => Promise<unknown>]> = [
    ['scrape-news', () => runScrapeNewsCore({ step: makeBypassStep('scrape-news'), logger: bypassLogger })],
    ['detect-resignations', () => runResignationDetectionCore({ step: makeBypassStep('detect-resignations'), logger: bypassLogger })],
    ['detect-verdicts', () => runVerdictDetectionCore({ step: makeBypassStep('detect-verdicts'), logger: bypassLogger })],
    ['detect-media-closures', () => runMediaClosureDetectionCore({ step: makeBypassStep('detect-media-closures'), logger: bypassLogger })],
    ['detect-asset-recoveries', () => runAssetRecoveryDetectionCore({ step: makeBypassStep('detect-asset-recoveries'), logger: bypassLogger })],
    ['detect-criminal-complaints', () => runCriminalComplaintDetectionCore({ step: makeBypassStep('detect-criminal-complaints'), logger: bypassLogger })],
    ['detect-watchlist-removals', () => runWatchlistRemovalDetectionCore({ step: makeBypassStep('detect-watchlist-removals'), logger: bypassLogger })],
    // 2026-09-16 — a detektorok UTÁN fut szándékosan: ha ugyanebben a körben
    // érkezett kiengedésről szóló cikk, az már frissítette a sort, és ez a
    // lépés nem riaszt feleslegesen. Nincs benne LLM-hívás (SELECT +
    // Telegram), tehát a napi keretre nulla hatással van.
    ['check-custody-expiry', () => runCustodyExpiryCheckCore({ step: makeBypassStep('check-custody-expiry'), logger: bypassLogger })],
  ];

  async function runAllSteps(): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const [name, run] of steps) {
      try {
        out[name] = await run();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        out[name] = { error: message };
        bypassLogger.error?.(`cron/pipeline: ${name} failed`, err);
      }
    }
    return out;
  }

  if (asyncMode) {
    // A munka a válasz elküldése UTÁN fut, de még ugyanabban a függvény-
    // meghívásban — a `maxDuration` (300 mp) továbbra is érvényes rá.
    after(async () => {
      const out = await runAllSteps();
      bypassLogger.info?.('cron/pipeline: async run kész', out);
    });
    return NextResponse.json({ started: true, mode: 'async' }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  }

  const results = await runAllSteps();

  return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
