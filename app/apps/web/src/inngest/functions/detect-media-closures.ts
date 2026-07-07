import 'server-only';
import { eq } from 'drizzle-orm';

import { detectMediaClosureFromArticle } from '@korr/db/ai-closures';
import {
  decideStatus,
  isDuplicate,
  isTransientLlmFailure,
  loadUncheckedArticles,
  markChecked,
  NEAR_MISS_MIN,
} from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { notifyReviewNeeded } from '@/lib/notify';
import { inngest } from '../client';

const BATCH_SIZE = 20;
const DETECTOR_TYPE = 'media_closure' as const;

const CLOSURE_KEYWORDS = [
  'megszűnt', 'megszűnik', 'bezár', 'bezárnak', 'leállítják', 'leáll', 'felszámol',
  'leépítés', 'leépít', 'leépítik', 'elbocsát', 'tömeges kirúgás', 'tömeges elbocsátás',
  'médium', 'szerkesztőség', 'csatorna', 'műsor', 'lap', 'portál',
  'felfüggesztik', 'felfüggesztés', 'elmarad', 'lemondják', 'nem jelenik meg',
];

/**
 * closure.detect — cron every hour.
 * Backlog scan (006) over NOT-YET-CHECKED articles from the last 7 days —
 * see specs/006-detection-pipeline-reliability. Auto-inserts confirmed rows
 * into MediaClosure; every non-inserted candidate is recorded in
 * DetectionCheck with a reason, except a transient LLM failure, which is
 * left unrecorded so the article is retried next run.
 */
export const detectMediaClosures = inngest.createFunction(
  { id: 'detect-media-closures', name: 'Detect media closures', concurrency: 1 },
  { cron: '40 * * * *' },
  async ({ step, logger }) => {
    const db = getDb();
    const todayIso = new Date().toISOString().slice(0, 10);

    const articles = await step.run('load-unchecked-articles', () =>
      loadUncheckedArticles(db, DETECTOR_TYPE),
    );

    if (articles.length === 0) return { scanned: 0, inserted: 0 };

    const candidates = articles.filter((a) => {
      const text = `${a.headline} ${a.excerpt}`.toLowerCase();
      return CLOSURE_KEYWORDS.some((kw) => text.includes(kw));
    });

    if (candidates.length === 0) return { scanned: articles.length, inserted: 0 };

    let inserted = 0;

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE);

      const batchInserted = await step.run(`process-batch-${batchNum}`, async () => {
        let count = 0;
        for (const article of batch) {
          const llmResult = await detectMediaClosureFromArticle(article.headline, article.excerpt, todayIso);

          if (isTransientLlmFailure(llmResult)) continue;

          const result = llmResult.data;

          if (!result || !result.isClosure) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'not_applicable',
            });
            continue;
          }

          if (!result.name) {
            await markChecked(db, {
              articleId: article.id,
              detectorType: DETECTOR_TYPE,
              outcome: 'discarded',
              reason: 'missing_fields',
              confidence: result.confidence,
            });
            continue;
          }

          // 003-review: media outlets aren't watchlist persons → confidence only.
          const reviewStatus = decideStatus(result.confidence, false);
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

          if (await isDuplicate(db, { table: 'MediaClosure', nameColumn: 'name' }, result.name)) {
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

          const fallbackDate = new Date(article.publishedAt as unknown as string);
          let eventDate: Date;
          try {
            eventDate = new Date(result.eventDate);
            if (isNaN(eventDate.getTime())) eventDate = fallbackDate;
          } catch {
            eventDate = fallbackDate;
          }

          await db.insert(schema.mediaClosures).values({
            name: result.name.slice(0, 200),
            eventType: result.eventType,
            description: result.description.slice(0, 1000) || null,
            eventDate,
            sourceUrl: article.sourceUrl,
            sourceName: article.sourceName,
            reviewStatus,
          });

          await db
            .update(schema.newsArticles)
            .set({ tag: 'Megszűnés' })
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

    logger?.info?.(`closure.detect: scanned=${articles.length} candidates=${candidates.length} inserted=${inserted}`);
    return { scanned: articles.length, candidates: candidates.length, inserted };
  },
);
