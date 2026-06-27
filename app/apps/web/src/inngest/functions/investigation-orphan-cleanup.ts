import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { inngest } from '../client';

/**
 * investigation.orphan-cleanup (T019, FR-006).
 *
 * Nightly 04:00 Europe/Budapest janitor that deletes ArticleClaim rows
 * whose parent article no longer exists in `NewsArticle` (for
 * `articleSource='news'`) or `KMonitorArticle` (for
 * `articleSource='kmonitor'`). Also drops the matching
 * ArticleExtractionRun rows so the article-claims viewer stops listing
 * them.
 *
 * Skips claims whose `createdAt > now() - interval '1 hour'` so a
 * janitor run that overlaps with in-flight extraction never deletes the
 * extraction's own rows (Edge Case: "Janitor runs while extraction is
 * in flight").
 */
export const investigationOrphanCleanup = inngest.createFunction(
  {
    id: 'investigation.orphan-cleanup',
    concurrency: [{ limit: 1 }],
    retries: 3,
  },
  { cron: 'TZ=Europe/Budapest 0 4 * * *' },
  async ({ step }) => {
    const result = await step.run('sweep-orphans', async () => {
      const db = getDb();
      const claimsDeleted = (await db.execute(sql`
        WITH stale AS (
          SELECT ac.id
            FROM "ArticleClaim" ac
           WHERE ac."createdAt" <= now() - interval '1 hour'
             AND (
                  (ac."articleSource" = 'news'
                   AND NOT EXISTS (
                         SELECT 1 FROM "NewsArticle" na
                          WHERE na.id::text = ac."articleId"))
               OR (ac."articleSource" = 'kmonitor'
                   AND NOT EXISTS (
                         SELECT 1 FROM "KMonitorArticle" ka
                          WHERE ka."newsId"::text = ac."articleId"))
             )
        )
        DELETE FROM "ArticleClaim"
         WHERE id IN (SELECT id FROM stale)
         RETURNING id
      `)) as Array<{ id: string }>;

      const runsDeleted = (await db.execute(sql`
        WITH stale_runs AS (
          SELECT aer."articleSource", aer."articleId", aer."extractorVersion"
            FROM "ArticleExtractionRun" aer
           WHERE aer."extractedAt" <= now() - interval '1 hour'
             AND (
                  (aer."articleSource" = 'news'
                   AND NOT EXISTS (
                         SELECT 1 FROM "NewsArticle" na
                          WHERE na.id::text = aer."articleId"))
               OR (aer."articleSource" = 'kmonitor'
                   AND NOT EXISTS (
                         SELECT 1 FROM "KMonitorArticle" ka
                          WHERE ka."newsId"::text = aer."articleId"))
             )
        )
        DELETE FROM "ArticleExtractionRun"
         WHERE ("articleSource", "articleId", "extractorVersion") IN (
                 SELECT "articleSource", "articleId", "extractorVersion"
                   FROM stale_runs)
         RETURNING "articleSource", "articleId", "extractorVersion"
      `)) as Array<{
        articleSource: string;
        articleId: string;
        extractorVersion: string;
      }>;

      return {
        claimsDeleted: claimsDeleted.length,
        runsDeleted: runsDeleted.length,
      };
    });

    Sentry.addBreadcrumb({
      category: 'investigation.orphan-cleanup',
      message: 'sweep-complete',
      data: result,
    });
    return result;
  },
);
