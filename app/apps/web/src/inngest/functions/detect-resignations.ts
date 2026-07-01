import 'server-only';
import { desc, eq, gte } from 'drizzle-orm';

import { detectResignationFromArticle } from '@korr/db/ai';
import { decideStatus, isDuplicate, isWatchlistPerson } from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

const BATCH_SIZE = 20;
// Scan articles published in the last 2 hours.
const LOOKBACK_MS = 2 * 60 * 60 * 1000;

// Quick keyword pre-filter — avoids burning LLM tokens on irrelevant articles.
const RESIGNATION_KEYWORDS = [
  'lemond', 'kirúg', 'felment', 'leváltott', 'leváltják', 'lemondott',
  'kirúgták', 'felmentették', 'távozik', 'távozott', 'mond le',
  'leváltás', 'menesztés', 'menesztette', 'menesztik',
];

/**
 * resignation.detect — cron every hour.
 * Scans articles published in the last 2 hours, runs them through Claude Haiku
 * to detect political resignations/firings/dismissals, and auto-inserts
 * confirmed rows into PoliticalResignation.
 */
export const detectResignations = inngest.createFunction(
  { id: 'detect-resignations', name: 'Detect political resignations', concurrency: 1 },
  { cron: '20 * * * *' },
  async ({ step, logger }) => {
    const db = getDb();

    const since = new Date(Date.now() - LOOKBACK_MS);
    const todayIso = new Date().toISOString().slice(0, 10);

    const articles = await step.run('load-recent-articles', async () =>
      db
        .select({
          id: schema.newsArticles.id,
          headline: schema.newsArticles.headline,
          excerpt: schema.newsArticles.excerpt,
          publishedAt: schema.newsArticles.publishedAt,
        })
        .from(schema.newsArticles)
        .where(gte(schema.newsArticles.publishedAt, since))
        .orderBy(desc(schema.newsArticles.publishedAt))
        .limit(200),
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
          const result = await detectResignationFromArticle(
            article.headline,
            article.excerpt,
            todayIso,
          );

          if (!result || !result.isResignation || !result.name || !result.institution) continue;

          // 003-review: route by confidence + watchlist; discard below the floor.
          const reviewStatus = decideStatus(result.confidence, isWatchlistPerson(result.name));
          if (reviewStatus === 'discard') continue;

          // Dedup by normalized name across ALL statuses within the window, so a
          // rejected detection is not re-created (FR-009, FR-011).
          if (await isDuplicate(db, { table: 'PoliticalResignation', nameColumn: 'name' }, result.name)) continue;

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
          });

          // Tag the source article so it appears in /hirek under the 'Lemondás' filter.
          await db
            .update(schema.newsArticles)
            .set({ tag: 'Lemondás' })
            .where(eq(schema.newsArticles.id, article.id));

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
