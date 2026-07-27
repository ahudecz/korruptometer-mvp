import 'server-only';
import { revalidateTag } from 'next/cache';
import { and, gte, sql } from 'drizzle-orm';

import { detectAssetRecoveryFromArticle } from '@korr/db/ai-assets';
import { fetchArticleBodyTransient } from '@korr/scrapers';
import { articleDateIso, isPlaceholderName, isTransientLlmFailure, loadUncheckedArticles, markChecked, NEAR_MISS_MIN, slugifyCaseLabel, type CheckReason } from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { notifyReviewNeeded } from '@/lib/notify';
import { notifyAutoPublished } from '@/lib/notify-auto-publish';
import { sendTelegramMessage } from '@/lib/telegram';
import { isBypassActive, type BypassStep, type BypassLogger } from '@/lib/cron-bypass';
import { inngest } from '../client';

const BATCH_SIZE = 20;
const DETECTOR_TYPE = 'asset_recovery' as const;
const CONFIDENCE_FLOOR = 0.7;

const ASSET_KEYWORDS = [
  'visszafizet', 'visszaszerz', 'vagyonelkobzás', 'elkobzás', 'lefoglalt',
  'kártérítés', 'visszatérít', 'megtérít', 'visszaadás', 'visszaadja',
  'bírság', 'kötbér', 'visszakövetel', 'közpénz', 'közjavak',
  'állami kár', 'kárösszeg', 'vagyoni kár', 'kompenzáció',
];

/**
 * asset.detect — cron every hour (offset 45 min).
 * Backlog scan (006) over NOT-YET-CHECKED articles from the last 7 days —
 * see specs/006-detection-pipeline-reliability. Auto-inserts confirmed rows
 * into AssetRecovery (this detector has no reviewStatus/pending concept —
 * unlike the other three, it always auto-inserts once confidence clears the
 * floor). Every non-inserted candidate is recorded in DetectionCheck with a
 * reason, except a transient LLM failure, which is left unrecorded so the
 * article is retried next run.
 */
// 2026-07-22 — kiemelve, hogy a Vercel-cron bypass route Inngest nélkül is
// meg tudja hívni (l. cron-bypass.ts fejléce).
export async function runAssetRecoveryDetectionCore({ step, logger }: { step: BypassStep; logger?: BypassLogger }) {
    const db = getDb();

    const articles = await step.run('load-unchecked-articles', () =>
      loadUncheckedArticles(db, DETECTOR_TYPE),
    );

    if (articles.length === 0) return { scanned: 0, inserted: 0 };

    const candidates = articles.filter((a) => {
      const text = `${a.headline} ${a.excerpt}`.toLowerCase();
      return ASSET_KEYWORDS.some((kw) => text.includes(kw));
    });

    if (candidates.length === 0) return { scanned: articles.length, inserted: 0 };

    let inserted = 0;

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE);

      const batchInserted = await step.run(`process-batch-${batchNum}`, async () => {
        let count = 0;
        for (const article of batch) {
          const llmResult = await detectAssetRecoveryFromArticle(article.headline, article.excerpt, articleDateIso(article.publishedAt));

          if (isTransientLlmFailure(llmResult)) continue;

          let result = llmResult.data;

          // 2026-07-24 — l. detect-resignations.ts azonos mintája. 2026-07-27
          // — recoveries tömbbé alakítva (l. asset-recovery-detect.ts fejléce):
          // "incomplete" most azt jelenti, hogy a tömb üres vagy bármelyik
          // eleme hiányos, nem csak azt, hogy egyetlen mező hiányzik.
          const seemsIncomplete =
            !result ||
            result.recoveries.length === 0 ||
            result.recoveries.some((r) => !r.caseLabel || isPlaceholderName(r.caseLabel) || !r.description);
          if (seemsIncomplete && article.sourceUrl) {
            const bodyText = await fetchArticleBodyTransient(article.sourceUrl).catch(() => null);
            if (bodyText && bodyText.length > article.excerpt.length) {
              const retryResult = await detectAssetRecoveryFromArticle(article.headline, bodyText, articleDateIso(article.publishedAt));
              if (!isTransientLlmFailure(retryResult) && retryResult.data) {
                result = retryResult.data;
              }
            }
          }

          if (!result || result.recoveries.length === 0) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'not_applicable',
            });
            continue;
          }

          // 2026-07-27 — egy cikk több KÜLÖNÁLLÓ összeget is jelenthet
          // (pl. két külön NKA-támogatás visszavonása egy miniszteri
          // bejelentésben) — mindegyiket önállóan végigvisszük az összes
          // korábbi ellenőrzésen. markChecked (articleId, detectorType)
          // kulcs szerint upsertel — l. detect-resignations.ts azonos
          // mintája — ezért CSAK EGY összegző hívás megy a ciklus végén,
          // különben egy per-item hívás felülírná az előzőt (pl. egy
          // 'inserted' állapotot egy másik item 'duplicate' eredménye).
          let anyInserted = false;
          const insertedLabels: string[] = [];
          let lastDiscardReason: CheckReason = 'not_applicable';
          let lastLabel: string | undefined;
          let lastConfidence: number | undefined;

          for (const item of result.recoveries) {
            lastLabel = item.caseLabel || lastLabel;
            lastConfidence = item.confidence;

            if (item.confidence < CONFIDENCE_FLOOR) {
              lastDiscardReason = 'low_confidence';
              if (item.confidence >= NEAR_MISS_MIN && item.caseLabel) {
                await notifyReviewNeeded({
                  type: 'near_miss',
                  detectorType: DETECTOR_TYPE,
                  name: item.caseLabel,
                  confidence: item.confidence,
                  articleUrl: article.sourceUrl ?? '',
                  articleId: article.id,
                });
              }
              continue;
            }

            if (!item.caseLabel || isPlaceholderName(item.caseLabel) || !item.description) {
              lastDiscardReason = 'missing_fields';
              continue;
            }

            // 2026-07-25 — NKA-eset: egy "eddig összesen X milliárd" futó
            // összesítőt a detektor korábban friss amountFt-ként vett fel,
            // majdnem duplikálva a korábbi bejegyzéseket ugyanabból az
            // ügyből. MINDIG (bypassConfidenceGate-től függetlenül is)
            // eldobjuk, ha a modell maga jelzi, hogy a szám összesítő — nincs
            // "Jóváhagyom" gomb, mert az csak újra beszúrná ugyanazt a rossz
            // számot; kézi Telegram-tipp (pontos új összeggel) a helyes út.
            if (item.amountIsCumulativeTotal) {
              lastDiscardReason = 'cumulative_total_ambiguous';
              await sendTelegramMessage(
                [
                  `⚠️ VAGYONVISSZASZERZÉS — futó összesítő, nem automatikus`,
                  `${item.caseLabel} — a cikk ${item.amountFt.toLocaleString('hu-HU')} Ft-os ÖSSZESÍTŐT közöl, nem azt, mennyi jött vissza ÚJONNAN.`,
                  `Ha van új infó a pontos növekményről, küldd be kézzel a linket + a helyes összeget.`,
                  article.sourceUrl ?? '',
                ].filter(Boolean).join('\n\n'),
              );
              continue;
            }

            // Dedup: skip if same caseLabel already recorded in last 14 days.
            const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
            const existing = await db
              .select({ id: schema.assetRecoveries.id })
              .from(schema.assetRecoveries)
              .where(
                and(
                  sql`lower(${schema.assetRecoveries.caseLabel}) = lower(${item.caseLabel})`,
                  gte(schema.assetRecoveries.createdAt, fourteenDaysAgo),
                ),
              )
              .limit(1);

            if (existing.length > 0) {
              lastDiscardReason = 'duplicate';
              continue;
            }

            // A public entry MUST always be traceable to a source article —
            // never publish an unsourced claim.
            if (!article.sourceUrl) {
              lastDiscardReason = 'missing_source';
              continue;
            }

            const fallbackDate = new Date(article.publishedAt as unknown as string);
            let recoveredAt: Date;
            try {
              recoveredAt = new Date(item.recoveredAt);
              if (isNaN(recoveredAt.getTime())) recoveredAt = fallbackDate;
            } catch {
              recoveredAt = fallbackDate;
            }

            const caseId = slugifyCaseLabel(item.caseLabel);

            const [insertedRow] = await db.insert(schema.assetRecoveries).values({
              caseId,
              caseLabel: item.caseLabel.slice(0, 200),
              description: item.description.slice(0, 1000),
              amountFt: BigInt(Math.round(item.amountFt)),
              recoveredAt,
              sourceUrl: article.sourceUrl,
              sourceName: article.sourceName,
            }).returning({ id: schema.assetRecoveries.id });

            anyInserted = true;
            insertedLabels.push(item.caseLabel);

            // 2026-07-14 — this detector has no reviewStatus/pending concept at
            // all (see file header), every insert is already a zero-review
            // auto-publish — so every insert gets the revert-notification.
            await notifyAutoPublished({
              target: 'asset_recovery',
              recordId: insertedRow!.id,
              name: item.caseLabel,
              detail: `~${(Number(item.amountFt) / 1_000_000_000).toFixed(2)} Mrd Ft`,
              articleUrl: article.sourceUrl ?? '',
            });
          }

          await markChecked(db, {
            articleId: article.id,
            detectorType: DETECTOR_TYPE,
            outcome: anyInserted ? 'inserted' : 'discarded',
            reason: anyInserted ? undefined : lastDiscardReason,
            extractedName: (insertedLabels.length > 0 ? insertedLabels.join(', ') : lastLabel)?.slice(0, 200),
            confidence: lastConfidence,
          });

          if (anyInserted) count++;
        }
        return count;
      });

      inserted += batchInserted;
    }

    // No reviewStatus/pending concept here (see file header) — every insert
    // is already public, so a plain inserted>0 check is the right gate.
    if (inserted > 0) {
      // Homepage latest-recoveries/total-recovered blocks are unstable_cache'd
      // (5min TTL) independent of any revalidatePath — bust them explicitly so
      // a cron-detected recovery shows up immediately, not up to 5min later.
      revalidateTag('asset-recoveries');
      await step.sendEvent('emit-breaking-recompute', {
        name: 'breaking.recompute',
        data: { reason: 'asset_recovery' },
      });
    }

    logger?.info?.(`asset.detect: scanned=${articles.length} candidates=${candidates.length} inserted=${inserted}`);
    return { scanned: articles.length, candidates: candidates.length, inserted };
}

export const detectAssetRecoveries = inngest.createFunction(
  { id: 'detect-asset-recoveries', name: 'Detect public asset recoveries', concurrency: 1 },
  { cron: '50 * * * *' },
  async ({ step, logger }) => {
    if (isBypassActive()) {
      logger?.info?.('detect-asset-recoveries: skipped — PIPELINE_BYPASS_INNGEST active, Vercel cron owns this run');
      return { skipped: 'inngest_bypass_active' };
    }
    return runAssetRecoveryDetectionCore({ step: step as unknown as BypassStep, logger });
  },
);
