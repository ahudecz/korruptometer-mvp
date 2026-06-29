import 'server-only';
import { desc, eq, gte } from 'drizzle-orm';

import { detectMediaClosureFromArticle } from '@korr/db/ai-closures';
import { decideStatus, isDuplicate } from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

const BATCH_SIZE = 20;
const LOOKBACK_MS = 2 * 60 * 60 * 1000;

const CLOSURE_KEYWORDS = [
  'megszűnt', 'megszűnik', 'bezár', 'bezárnak', 'leállítják', 'leáll', 'felszámol',
  'leépítés', 'leépít', 'leépítik', 'elbocsát', 'tömeges kirúgás', 'tömeges elbocsátás',
  'médium', 'szerkesztőség', 'csatorna', 'műsor', 'lap', 'portál',
  'felfüggesztik', 'felfüggesztés', 'elmarad', 'lemondják', 'nem jelenik meg',
];

/**
 * closure.detect — cron every hour.
 * Scans recent articles for NER media closures/mass layoffs/cancelled events
 * and auto-inserts confirmed rows into MediaClosure.
 */
export const detectMediaClosures = inngest.createFunction(
  { id: 'detect-media-closures', name: 'Detect media closures', concurrency: 1 },
  { cron: '30 * * * *' },
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
          sourceUrl: schema.newsArticles.sourceUrl,
        })
        .from(schema.newsArticles)
        .where(gte(schema.newsArticles.publishedAt, since))
        .orderBy(desc(schema.newsArticles.publishedAt))
        .limit(200),
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
          const result = await detectMediaClosureFromArticle(
            article.headline,
            article.excerpt,
            todayIso,
          );

          if (!result || !result.isClosure || !result.name) continue;

          // 003-review: media outlets aren't watchlist persons → confidence only.
          const reviewStatus = decideStatus(result.confidence, false);
          if (reviewStatus === 'discard') continue;
          if (await isDuplicate(db, { table: 'MediaClosure', nameColumn: 'name' }, result.name)) continue;

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
            sourceUrl: article.sourceUrl ?? null,
            sourceName: null,
            reviewStatus,
          });

          await db
            .update(schema.newsArticles)
            .set({ tag: 'Megszűnés' })
            .where(eq(schema.newsArticles.id, article.id));

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
