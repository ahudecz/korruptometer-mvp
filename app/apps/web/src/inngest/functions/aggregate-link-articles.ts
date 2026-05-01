import 'server-only';
import { sql, inArray } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

const DEFAULT_AUTO = 0.55;
const DEFAULT_REVIEW = 0.4;

function thresholds() {
  const auto = Number(process.env.LINK_AUTO_THRESHOLD ?? DEFAULT_AUTO);
  const review = Number(process.env.LINK_REVIEW_THRESHOLD ?? DEFAULT_REVIEW);
  return { auto, review };
}

function concurrencyCap(): number {
  const v = Number(process.env.LINK_AGGREGATOR_CONCURRENCY ?? 4);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 4;
}

/**
 * aggregate.link-articles (T157) — event-chained after scrape.news. For
 * each new article, computes trigram similarity between the article text
 * (headline + excerpt) and every Case row's (name + position) using
 * unaccent + pg_trgm. When the top match is ≥ LINK_AUTO_THRESHOLD the
 * article gets relatedCaseId set; between thresholds we record the
 * confidence only; below the review threshold nothing is written.
 *
 * Rows where linkOverridden = true are NEVER touched on subsequent runs
 * (FR-066, SC-026).
 */
export const aggregateLinkArticles = inngest.createFunction(
  {
    id: 'aggregate-link-articles',
    name: 'Aggregate / link articles',
    concurrency: { limit: concurrencyCap() },
  },
  { event: 'aggregate.link-articles' },
  async ({ event, step }) => {
    const { auto, review } = thresholds();
    const ids = (event.data.articleIds ?? []).filter((s): s is string => !!s);
    if (ids.length === 0) return { processed: 0 };

    const db = getDb();
    const targets = await step.run('load-articles', async () =>
      db
        .select({
          id: schema.newsArticles.id,
          headline: schema.newsArticles.headline,
          excerpt: schema.newsArticles.excerpt,
          linkOverridden: schema.newsArticles.linkOverridden,
        })
        .from(schema.newsArticles)
        .where(inArray(schema.newsArticles.id, ids)),
    );

    let linked = 0;
    let recorded = 0;
    for (const article of targets) {
      if (article.linkOverridden) continue;
      await step.run(`link-${article.id}`, async () => {
        const articleText = `${article.headline} ${article.excerpt}`;
        const rows = await db.execute<{ id: string; score: number }>(sql`
          SELECT id,
                 similarity(unaccent(name || ' ' || position), unaccent(${articleText})) AS score
            FROM "Case"
           ORDER BY score DESC
           LIMIT 1
        `);
        const top = (rows as unknown as Array<{ id: string; score: number }>)[0];
        if (!top) return;
        const score = Number(top.score);
        const confidencePct = Math.round(score * 100);
        if (score >= auto) {
          await db
            .update(schema.newsArticles)
            .set({ relatedCaseId: top.id, linkConfidence: confidencePct })
            .where(sql`id = ${article.id} AND "linkOverridden" = false`);
          linked += 1;
        } else if (score >= review) {
          await db
            .update(schema.newsArticles)
            .set({ linkConfidence: confidencePct })
            .where(sql`id = ${article.id} AND "linkOverridden" = false`);
          recorded += 1;
        }
      });
    }
    return { processed: targets.length, linked, recorded };
  },
);
