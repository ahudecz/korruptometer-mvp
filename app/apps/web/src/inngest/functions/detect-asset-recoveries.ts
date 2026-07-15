import 'server-only';
import { revalidateTag } from 'next/cache';
import { and, gte, sql } from 'drizzle-orm';

import { detectAssetRecoveryFromArticle } from '@korr/db/ai-assets';
import { articleDateIso, isPlaceholderName, isTransientLlmFailure, loadUncheckedArticles, markChecked, NEAR_MISS_MIN, slugifyCaseLabel } from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { notifyReviewNeeded } from '@/lib/notify';
import { notifyAutoPublished } from '@/lib/notify-auto-publish';
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
export const detectAssetRecoveries = inngest.createFunction(
  { id: 'detect-asset-recoveries', name: 'Detect public asset recoveries', concurrency: 1 },
  { cron: '50 * * * *' },
  async ({ step, logger }) => {
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

          const result = llmResult.data;

          if (!result || !result.isRecovery) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'not_applicable',
            });
            continue;
          }

          if (result.confidence < CONFIDENCE_FLOOR) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'low_confidence',
              extractedName: result.caseLabel || undefined,
              confidence: result.confidence,
            });
            if (result.confidence >= NEAR_MISS_MIN && result.caseLabel) {
              await notifyReviewNeeded({
                type: 'near_miss',
                detectorType: DETECTOR_TYPE,
                name: result.caseLabel,
                confidence: result.confidence,
                articleUrl: article.sourceUrl ?? '',
                articleId: article.id,
              });
            }
            continue;
          }

          if (!result.caseLabel || isPlaceholderName(result.caseLabel) || !result.description) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'missing_fields',
              confidence: result.confidence,
            });
            continue;
          }

          // Dedup: skip if same caseLabel already recorded in last 14 days.
          const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
          const existing = await db
            .select({ id: schema.assetRecoveries.id })
            .from(schema.assetRecoveries)
            .where(
              and(
                sql`lower(${schema.assetRecoveries.caseLabel}) = lower(${result.caseLabel})`,
                gte(schema.assetRecoveries.createdAt, fourteenDaysAgo),
              ),
            )
            .limit(1);

          if (existing.length > 0) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'duplicate',
              extractedName: result.caseLabel,
              confidence: result.confidence,
            });
            continue;
          }

          // A public entry MUST always be traceable to a source article —
          // never publish an unsourced claim.
          if (!article.sourceUrl) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'missing_source',
              extractedName: result.caseLabel,
              confidence: result.confidence,
            });
            continue;
          }

          const fallbackDate = new Date(article.publishedAt as unknown as string);
          let recoveredAt: Date;
          try {
            recoveredAt = new Date(result.recoveredAt);
            if (isNaN(recoveredAt.getTime())) recoveredAt = fallbackDate;
          } catch {
            recoveredAt = fallbackDate;
          }

          const caseId = slugifyCaseLabel(result.caseLabel);

          const [insertedRow] = await db.insert(schema.assetRecoveries).values({
            caseId,
            caseLabel: result.caseLabel.slice(0, 200),
            description: result.description.slice(0, 1000),
            amountFt: BigInt(Math.round(result.amountFt)),
            recoveredAt,
            sourceUrl: article.sourceUrl,
            sourceName: article.sourceName,
          }).returning({ id: schema.assetRecoveries.id });

          await markChecked(db, {
            articleId: article.id,
            detectorType: DETECTOR_TYPE,
            outcome: 'inserted',
            extractedName: result.caseLabel,
            confidence: result.confidence,
          });

          // 2026-07-14 — this detector has no reviewStatus/pending concept at
          // all (see file header), every insert is already a zero-review
          // auto-publish — so every insert gets the revert-notification.
          await notifyAutoPublished({
            target: 'asset_recovery',
            recordId: insertedRow!.id,
            name: result.caseLabel,
            detail: `~${(Number(result.amountFt) / 1_000_000_000).toFixed(2)} Mrd Ft`,
            articleUrl: article.sourceUrl ?? '',
          });

          count++;
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
  },
);
