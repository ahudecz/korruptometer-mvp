import { NextResponse } from 'next/server';

import { bypassLogger, isBypassActive, makeBypassStep, verifyCronRequest } from '@/lib/cron-bypass';
import { runScrapeNewsCore } from '@/inngest/functions/scrape-news';
import { runResignationDetectionCore } from '@/inngest/functions/detect-resignations';
import { runVerdictDetectionCore } from '@/inngest/functions/detect-verdicts';
import { runMediaClosureDetectionCore } from '@/inngest/functions/detect-media-closures';
import { runAssetRecoveryDetectionCore } from '@/inngest/functions/detect-asset-recoveries';
import { runCriminalComplaintDetectionCore } from '@/inngest/functions/detect-criminal-complaints';
import { runWatchlistRemovalDetectionCore } from '@/inngest/functions/detect-watchlist-removals';

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

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isBypassActive()) {
    return NextResponse.json({ skipped: 'bypass_not_active' });
  }

  const steps: Array<[string, () => Promise<unknown>]> = [
    ['scrape-news', () => runScrapeNewsCore({ step: makeBypassStep('scrape-news'), logger: bypassLogger })],
    ['detect-resignations', () => runResignationDetectionCore({ step: makeBypassStep('detect-resignations'), logger: bypassLogger })],
    ['detect-verdicts', () => runVerdictDetectionCore({ step: makeBypassStep('detect-verdicts'), logger: bypassLogger })],
    ['detect-media-closures', () => runMediaClosureDetectionCore({ step: makeBypassStep('detect-media-closures'), logger: bypassLogger })],
    ['detect-asset-recoveries', () => runAssetRecoveryDetectionCore({ step: makeBypassStep('detect-asset-recoveries'), logger: bypassLogger })],
    ['detect-criminal-complaints', () => runCriminalComplaintDetectionCore({ step: makeBypassStep('detect-criminal-complaints'), logger: bypassLogger })],
    ['detect-watchlist-removals', () => runWatchlistRemovalDetectionCore({ step: makeBypassStep('detect-watchlist-removals'), logger: bypassLogger })],
  ];

  const results: Record<string, unknown> = {};
  for (const [name, run] of steps) {
    try {
      results[name] = await run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results[name] = { error: message };
      bypassLogger.error?.(`cron/pipeline: ${name} failed`, err);
    }
  }

  return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
