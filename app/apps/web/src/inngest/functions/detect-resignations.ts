import 'server-only';
import { eq } from 'drizzle-orm';

import { detectResignationFromArticle } from '@korr/db/ai';
import {
  decideStatus,
  isDuplicate,
  isTransientLlmFailure,
  isWatchlistPerson,
  loadUncheckedArticles,
  markChecked,
  NEAR_MISS_MIN,
} from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { notifyReviewNeeded } from '@/lib/notify';
import { inngest } from '../client';

const BATCH_SIZE = 20;
const DETECTOR_TYPE = 'resignation' as const;

// Quick keyword pre-filter — avoids burning LLM tokens on irrelevant articles.
const RESIGNATION_KEYWORDS = [
  'lemond', 'kirúg', 'felment', 'leváltott', 'leváltják', 'lemondott',
  'kirúgták', 'felmentették', 'távozik', 'távozott', 'mond le',
  'leváltás', 'menesztés', 'menesztette', 'menesztik',
];

/**
 * resignation.detect — cron every hour.
 * Scans NOT-YET-CHECKED articles from the last 7 days (006 backlog scan —
 * replaces the old fixed 2h lookback so a transient LLM outage can never
 * silently drop a candidate forever, see specs/006-detection-pipeline-reliability),
 * runs them through the switchable LLM layer to detect political
 * resignations/firings/dismissals, and auto-inserts confirmed rows into
 * PoliticalResignation. Every non-inserted candidate is recorded in
 * DetectionCheck with a specific reason — except a transient API failure,
 * which is left unrecorded so the article is retried next run.
 */
export const detectResignations = inngest.createFunction(
  { id: 'detect-resignations', name: 'Detect political resignations', concurrency: 1 },
  { cron: '20 * * * *' },
  async ({ step, logger }) => {
    const db = getDb();
    const todayIso = new Date().toISOString().slice(0, 10);

    const articles = await step.run('load-unchecked-articles', () =>
      loadUncheckedArticles(db, DETECTOR_TYPE),
    );

    if (articles.length === 0) return { scanned: 0, inserted: 0 };

    const candidates = articles.filter((a) => {
      const text = `${a.headline} ${a.excerpt}`.toLowerCase();
      return RESIGNATION_KEYWORDS.some((kw) => text.includes(kw));
    });

    if (candidates.length === 0) return { scanned: articles.length, inserted: 0 };

    let inserted = 0;

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE);

      const batchInserted = await step.run(`process-batch-${batchNum}`, async () => {
        let count = 0;
        for (const article of batch) {
          const llmResult = await detectResignationFromArticle(article.headline, article.excerpt, todayIso);

          // Transient (API/network/credit) failure — leave unrecorded so the
          // article stays eligible and is retried on the next hourly run.
          if (isTransientLlmFailure(llmResult)) continue;

          const result = llmResult.data;

          if (!result || !result.isResignation) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'not_applicable',
            });
            continue;
          }

          if (!result.name || !result.institution) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'missing_fields',
              extractedName: result.name || undefined,
              confidence: result.confidence,
            });
            continue;
          }

          // 003-review: route by confidence + watchlist; discard below the floor.
          const reviewStatus = decideStatus(result.confidence, isWatchlistPerson(result.name));
          if (reviewStatus === 'discard') {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'low_confidence',
              extractedName: result.name,
              confidence: result.confidence,
            });
            if (result.confidence >= NEAR_MISS_MIN) {
              await notifyReviewNeeded({
                type: 'near_miss',
                detectorType: DETECTOR_TYPE,
                name: result.name,
                confidence: result.confidence,
                articleUrl: article.sourceUrl ?? '',
              });
            }
            continue;
          }

          // Dedup by normalized name across ALL statuses within the window, so a
          // rejected detection is not re-created (FR-009, FR-011).
          if (await isDuplicate(db, { table: 'PoliticalResignation', nameColumn: 'name' }, result.name)) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'duplicate',
              extractedName: result.name,
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
              extractedName: result.name,
              confidence: result.confidence,
            });
            continue;
          }

          // article.publishedAt is serialized as string by Inngest JSON
          const fallbackDate = new Date(article.publishedAt as unknown as string);
          let resignationDate: Date;
          try {
            resignationDate = new Date(result.resignationDate);
            if (isNaN(resignationDate.getTime())) resignationDate = fallbackDate;
          } catch {
            resignationDate = fallbackDate;
          }

          const pinned = isWatchlistPerson(result.name);

          await db.insert(schema.politicalResignations).values({
            name: result.name.slice(0, 200),
            position: result.position.slice(0, 200),
            institution: result.institution.slice(0, 200),
            resignationType: result.resignationType,
            resignationDate,
            description: result.description.slice(0, 1000) || null,
            pinned,
            reviewStatus,
            sourceUrls: [article.sourceUrl],
            sourceNames: article.sourceName ? [article.sourceName] : [],
          });

          // Tag the source article so it appears in /hirek under the 'Lemondás' filter.
          // Watchlist persons (pinned) and auto-approved detections are marked as
          // breaking candidates so the BreakingBanner fires without manual override.
          await db
            .update(schema.newsArticles)
            .set({
              tag: 'Lemondás',
              isBreakingCandidate: pinned || reviewStatus === 'approved',
            })
            .where(eq(schema.newsArticles.id, article.id));

          await markChecked(db, {
            articleId: article.id,
            detectorType: DETECTOR_TYPE,
            outcome: 'inserted',
            extractedName: result.name,
            confidence: result.confidence,
          });

          if (reviewStatus === 'pending') {
            await notifyReviewNeeded({
              type: 'pending',
              detectorType: DETECTOR_TYPE,
              name: result.name,
              confidence: result.confidence,
              articleUrl: article.sourceUrl ?? '',
            });
          }

          count++;
        }
        return count;
      });

      inserted += batchInserted;
    }

    logger?.info?.(
      `resignation.detect: scanned=${articles.length} candidates=${candidates.length} inserted=${inserted}`,
    );
    return { scanned: articles.length, candidates: candidates.length, inserted };
  },
);
