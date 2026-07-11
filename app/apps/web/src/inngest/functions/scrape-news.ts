import 'server-only';
import { eq } from 'drizzle-orm';

import { adapters, canonicalUrl, dedupHash, scrapeRelevanceTier, isBreaking, shouldFeature } from '@korr/scrapers';
import type { OutletSlug, ScrapedArticle } from '@korr/scrapers';
import { schema } from '@/lib/db';
import { getDb } from '@/lib/db';
import { postEditorAlert } from '@/lib/slack';
import { classifyArticle } from '@/lib/ai-classify';
import { findSameStoryDuplicate } from '@/lib/same-story';
import { getMonitoredBreakingNames } from '@/lib/breaking-monitored';

import { inngest } from '../client';

const FAILURE_DISABLE_THRESHOLD = 5;
const ZERO_ARTICLE_ALERT_THRESHOLD = 5;

/**
 * scrape.news (T151) — runs every hour on a cron, fans out one
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
  { cron: '0 * * * *' },
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
          const inserted = await persistArticles(source.id, adapter.queryAllowlist, scraped, adapter.relevantByDefault ?? false, logger);
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
  logger?: { info?: (...a: unknown[]) => void },
): Promise<string[]> {
  const db = getDb();
  const insertedIds: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Scrape-relevancia 3 kupacban (003): a "biztos jó" és "biztos kuka" kulcsszó/
  // URL alapján dől el INGYEN; az AI CSAK a bizonytalan "maybe" kupacra fut, ha
  // van LLM-kulcs. Így olcsó marad, mégis kiszűri a külföld/szemét híreket.
  const useAi = Boolean(process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY);
  const monitoredNames = getMonitoredBreakingNames();

  for (const a of scraped) {
    const canonical = canonicalUrl(a.sourceUrl, allowlist);

    // 1. Ingyenes előszűrés (kulcsszó + URL-szekció).
    const tier = scrapeRelevanceTier(a.headline, a.excerpt, canonical, relevantByDefault);
    if (tier === 'out') continue; // biztos kuka — AI nélkül eldobjuk

    const hash = dedupHash(canonical);

    let finalExcerpt = a.excerpt;
    let finalTag = a.tag ?? null;
    let finalFeatured = shouldFeature(a.headline, a.excerpt);
    // Breaking-jelölt: börtön/eljárás-trigger + figyelt személy/ügy (kulcsszavas, AI nélkül).
    const finalBreaking = isBreaking(a.headline, a.excerpt, monitoredNames);

    // 2. AI CSAK a bizonytalan "maybe" kupacra (és csak ha van kulcs).
    if (tier === 'maybe' && useAi) {
      try {
        const ai = await classifyArticle(a.headline, a.excerpt);
        totalInputTokens += ai.inputTokens;
        totalOutputTokens += ai.outputTokens;

        // 2026-07-11: ai.apiFailed (pl. kifogyott Anthropic-kredit) korábban
        // itt is 'nem releváns'-ként jött vissza, mert classifyArticle a
        // saját hibáját relevant:false-ként adta vissza — emiatt EVERY
        // maybe-kupacos cikk (minden relevantByDefault forrásból, ha nincs
        // kemény kulcsszó-találat) csendben kimaradt, amíg az API-kulcs
        // nem működött. Most explicit: API-hiba esetén megtartjuk
        // (megbízható forrás, eredeti adatokkal) — csak a TÉNYLEGES "nem
        // releváns" LLM-döntés dob el.
        if (ai.apiFailed) {
          logger?.info?.(`classifyArticle: API hiba, megtartva (fail-open) — "${a.headline}"`);
        } else if (!ai.relevant) {
          continue; // az AI szerint szemét → eldobjuk
        } else {
          finalExcerpt = ai.excerpt || a.excerpt;
          if (ai.tag) finalTag = ai.tag;
          if (ai.tag === 'lemondás') finalFeatured = true;
        }
      } catch {
        // API hiba esetén megtartjuk (megbízható forrás), eredeti adatokkal
      }
    }

    // 3. Kereszt-forrásos "ugyanaz a sztori" szűrő — más forrásból, más URL-lel
    // beérkező, de ugyanarról a valós eseményről szóló cikket nem szúrjuk be
    // duplikátumként (pl. Telex/HVG/Magyar Hang mind ugyanazt a hírt írja meg).
    const sameStory = await findSameStoryDuplicate({ headline: a.headline, excerpt: finalExcerpt, sourceId });
    if (sameStory.duplicate) {
      logger?.info?.(`same-story: skipped "${a.headline}" (matches ${sameStory.matchId}, via ${sameStory.via})`);
      continue;
    }

    const inserted = await db
      .insert(schema.newsArticles)
      .values({
        sourceId,
        headline: a.headline.slice(0, 500),
        excerpt: finalExcerpt,
        sourceUrl: canonical,
        sourceUrlHash: hash,
        publishedAt: a.publishedAt,
        tag: finalTag,
        imageUrl: a.imageUrl ?? null,
        featured: finalFeatured,
        isBreakingCandidate: finalBreaking,
      })
      .onConflictDoNothing({ target: schema.newsArticles.sourceUrlHash })
      .returning({ id: schema.newsArticles.id });
    if (inserted[0]) insertedIds.push(inserted[0].id);
  }

  if (useAi && (totalInputTokens > 0 || totalOutputTokens > 0)) {
    const costUsd = ((totalInputTokens / 1_000_000) * 0.8 + (totalOutputTokens / 1_000_000) * 4).toFixed(5);
    logger?.info?.(`AI classify: ${totalInputTokens} in + ${totalOutputTokens} out tokens = ~$${costUsd}`);
  }

  return insertedIds;
}
