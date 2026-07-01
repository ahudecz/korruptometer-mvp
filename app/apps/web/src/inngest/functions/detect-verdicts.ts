import 'server-only';
import { desc, eq, gte } from 'drizzle-orm';

import { detectVerdictFromArticle } from '@korr/db/ai-verdicts';
import { decideStatus, isDuplicate, isWatchlistPerson } from '@korr/db';
import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

const BATCH_SIZE = 20;
const LOOKBACK_MS = 2 * 60 * 60 * 1000;

const VERDICT_KEYWORDS = [
  'előzetes letartóztatás', 'letartóztatt', 'előzetesbe', 'előzetesben',
  'vádemelés', 'vádat emel', 'vádlott', 'bírósági ítélet',
  'börtönbüntetés', 'szabadságvesztés', 'elítélt', 'elítélték',
  'jogerős', 'elsőfokú ítélet', 'bíróság elé', 'bíróság ítélt',
  'fogdába', 'fogvatartott', 'kihallgat', 'gyanúsított',
];

/**
 * verdict.detect — cron every hour (offset 15 min).
 * Scans recent articles for court verdicts / pretrial detentions
 * and auto-inserts confirmed rows into CourtVerdict.
 */
export const detectVerdicts = inngest.createFunction(
  { id: 'detect-verdicts', name: 'Detect court verdicts and pretrial detentions', concurrency: 1 },
  { cron: '30 */2 * * *' },
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
      return VERDICT_KEYWORDS.some((kw) => text.includes(kw));
    });

    if (candidates.length === 0) return { scanned: articles.length, inserted: 0 };

    let inserted = 0;

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE);

      const batchInserted = await step.run(`process-batch-${batchNum}`, async () => {
        let count = 0;
        for (const article of batch) {
          const result = await detectVerdictFromArticle(
            article.headline,
            article.excerpt,
            todayIso,
          );

          if (!result || !result.isVerdict || !result.personName || !result.verdictType) continue;

          // 003-review: route by confidence + watchlist; discard below the floor.
          const reviewStatus = decideStatus(result.confidence, isWatchlistPerson(result.personName));
          if (reviewStatus === 'discard') continue;
          if (await isDuplicate(db, { table: 'CourtVerdict', nameColumn: 'personName' }, result.personName)) continue;

          const fallbackDate = new Date(article.publishedAt as unknown as string);
          let verdictDate: Date;
          try {
            verdictDate = new Date(result.verdictDate);
            if (isNaN(verdictDate.getTime())) verdictDate = fallbackDate;
          } catch {
            verdictDate = fallbackDate;
          }

          const sourceUrl = article.sourceUrl ?? null;

          await db.insert(schema.courtVerdicts).values({
            personName: result.personName.slice(0, 200),
            position: result.position.slice(0, 200),
            crimes: result.crimes.map((c) => c.slice(0, 200)),
            sentenceYears: result.sentenceYears ?? 0,
            sentenceMonths: result.sentenceMonths ?? null,
            sentenceLabel: (result.sentenceLabel ?? '').slice(0, 200),
            verdictType: result.verdictType,
            verdictDate,
            court: (result.court || 'Ismeretlen bíróság').slice(0, 200),
            summary: result.summary.slice(0, 1000),
            sourceUrls: sourceUrl ? [sourceUrl] : [],
            sourceNames: [],
            sourceHeadlines: article.headline ? [article.headline.slice(0, 500)] : [],
            sourceDates: [todayIso],
            reviewStatus,
          });

          // Egy detektált ítélet/előzetes börtönhöz kötődő esemény → breaking-jelölt,
          // így megjelenik a breaking csíkban és az érintett doboz/végoldal breaking blokkjában.
          await db
            .update(schema.newsArticles)
            .set({ tag: 'Ítélet', isBreakingCandidate: true })
            .where(eq(schema.newsArticles.id, article.id));

          count++;
        }
        return count;
      });

      inserted += batchInserted;
    }

    logger?.info?.(`verdict.detect: scanned=${articles.length} candidates=${candidates.length} inserted=${inserted}`);
    return { scanned: articles.length, candidates: candidates.length, inserted };
  },
);
