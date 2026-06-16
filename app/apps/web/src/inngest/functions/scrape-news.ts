import 'server-only';
import { eq } from 'drizzle-orm';

import { adapters, canonicalUrl, dedupHash, isRelevant, shouldFeature } from '@korr/scrapers';
import type { OutletSlug, ScrapedArticle } from '@korr/scrapers';
import { schema } from '@/lib/db';
import { getDb } from '@/lib/db';
import { postEditorAlert } from '@/lib/slack';

import { inngest } from '../client';

const FAILURE_DISABLE_THRESHOLD = 5;
const ZERO_ARTICLE_ALERT_THRESHOLD = 5;

/**
 * scrape.news (T151) — runs every 30 min on a cron, fans out one
 * step.run per enabled Source, persists new NewsArticle rows deduped by
 * sourceUrlHash, writes a ScraperRun row, bumps Source.lastScrapedAt /
 * lastSuccessAt / consecutiveFailures, auto-disables a source after 5
 * consecutive failures, and posts a Slack alert when an outlet returns 0
 * articles 5 runs in a row (the "silent rot" detector — T175).
 *
 * After the batch finishes, the function emits aggregate.link-articles
 * with the IDs of every freshly inserted article so the aggregator
 * (T157) can resolve case linkage.
 */
export const scrapeNews = inngest.createFunction(
  { id: 'scrape-news', name: 'Scrape news', concurrency: 2 },
  { cron: '*/30 * * * *' },
  async ({ step, logger }) => {
    const db = getDb();

    const sources = await step.run('list-sources', async () =>
      db.select().from(schema.sources).where(eq(schema.sources.enabled, true)),
    );

    const insertedIds: string[] = [];

    for (const source of sources) {
      const adapter = adapters[source.slug as OutletSlug];
      if (!adapter) {
        logger?.warn?.(`scrape.news: no adapter for source ${source.slug}`);
        continue;
      }

      const result = await step.run(`run-${source.slug}`, async () => {
        const startedAt = new Date();
        const [run] = await db
          .insert(schema.scraperRuns)
          .values({ sourceId: source.id, startedAt, status: 'running' })
          .returning({ id: schema.scraperRuns.id });

        try {
          const scraped = await adapter.crawl();
          const inserted = await persistArticles(source.id, adapter.queryAllowlist, scraped, adapter.relevantByDefault ?? false);
          const finishedAt = new Date();
          await db
            .update(schema.scraperRuns)
            .set({
              finishedAt,
              status: 'success',
              articlesFound: scraped.length,
              articlesNew: inserted.length,
            })
            .where(eq(schema.scraperRuns.id, run!.id));
          await db
            .update(schema.sources)
            .set({
              lastScrapedAt: startedAt,
              lastSuccessAt: finishedAt,
              consecutiveFailures: 0,
            })
            .where(eq(schema.sources.id, source.id));
          return { ok: true, found: scraped.length, inserted };
        } catch (err) {
          const finishedAt = new Date();
          const message = err instanceof Error ? err.message : 'unknown';
          await db
            .update(schema.scraperRuns)
            .set({
              finishedAt,
              status: 'failure',
              errorMessage: message,
            })
            .where(eq(schema.scraperRuns.id, run!.id));
          const nextFailures = source.consecutiveFailures + 1;
          await db
            .update(schema.sources)
            .set({
              lastScrapedAt: startedAt,
              consecutiveFailures: nextFailures,
              enabled: nextFailures < FAILURE_DISABLE_THRESHOLD,
            })
            .where(eq(schema.sources.id, source.id));
          if (nextFailures >= FAILURE_DISABLE_THRESHOLD) {
            await postEditorAlert(
              `Source *${source.slug}* auto-disabled after ${nextFailures} consecutive failures: ${message}`,
            );
          }
          return { ok: false, found: 0, inserted: [] as string[], error: message };
        }
      });

      if (result.ok) insertedIds.push(...result.inserted);

      // Silent-rot detector: 5 consecutive zero-article (HTTP 200) runs.
      if (result.ok && result.found === 0) {
        await step.run(`silent-rot-${source.slug}`, async () => {
          const recent = await db
            .select({ articlesFound: schema.scraperRuns.articlesFound })
            .from(schema.scraperRuns)
            .where(eq(schema.scraperRuns.sourceId, source.id))
            .orderBy(schema.scraperRuns.startedAt)
            .limit(ZERO_ARTICLE_ALERT_THRESHOLD);
          if (
            recent.length === ZERO_ARTICLE_ALERT_THRESHOLD &&
            recent.every((r) => r.articlesFound === 0)
          ) {
            await postEditorAlert(
              `Source *${source.slug}* returned 0 articles ${ZERO_ARTICLE_ALERT_THRESHOLD} runs in a row — no articles parsed (selector drift?).`,
            );
          }
        });
      }
    }

    if (insertedIds.length > 0) {
      await step.sendEvent('emit-aggregate', {
        name: 'aggregate.link-articles',
        data: { articleIds: insertedIds },
      });
      // T020 — fan out one investigation.article.ingested per new article
      // so the extraction Inngest function (FR-001) picks it up.
      await step.sendEvent(
        'emit-ingested',
        insertedIds.map((id) => ({
          name: 'investigation.article.ingested' as const,
          data: { articleSource: 'news' as const, articleId: id },
        })),
      );
    }

    return { sources: sources.length, newArticles: insertedIds.length };
  },
);

async function persistArticles(
  sourceId: string,
  allowlist: readonly string[],
  scraped: ScrapedArticle[],
  relevantByDefault: boolean,
): Promise<string[]> {
  const db = getDb();
  const insertedIds: string[] = [];
  for (const a of scraped) {
    if (!relevantByDefault && !isRelevant(a.headline, a.excerpt)) continue;
    const canonical = canonicalUrl(a.sourceUrl, allowlist);
    const hash = dedupHash(canonical);
    const inserted = await db
      .insert(schema.newsArticles)
      .values({
        sourceId,
        headline: a.headline.slice(0, 500),
        excerpt: a.excerpt,
        sourceUrl: canonical,
        sourceUrlHash: hash,
        publishedAt: a.publishedAt,
        tag: a.tag ?? null,
        imageUrl: a.imageUrl ?? null,
        featured: shouldFeature(a.headline, a.excerpt),
      })
      .onConflictDoNothing({ target: schema.newsArticles.sourceUrlHash })
      .returning({ id: schema.newsArticles.id });
    if (inserted[0]) insertedIds.push(inserted[0].id);
  }
  return insertedIds;
}
