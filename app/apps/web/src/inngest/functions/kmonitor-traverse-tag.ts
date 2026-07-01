import 'server-only';
import { eq, inArray } from 'drizzle-orm';

import {
  canonicalUrl,
  dedupHash,
  fetchPrimaryArticle,
  getAdapter,
  paginateKMonitorTag,
  routeOutletByUrl,
} from '@korr/scrapers';
import type { DiscoveredArticleRef } from '@korr/scrapers';
import { getDb, schema } from '@/lib/db';

import { inngest } from '../client';

const BATCH_SIZE = 25;

/**
 * kmonitor.traverse-tag (FR-078, FR-079) — event-driven. Paginates one
 * approved K-Monitor tag, routes each discovered primary URL to the
 * matching OutletAdapter by hostname, fetches the article through the
 * httpGetWithArchiveFallback wrapper (FR-080), and persists a NewsArticle
 * row tagged with the originating outlet. K-Monitor never appears as
 * `source` and K-Monitor's editorial excerpt is never persisted.
 */
export const kmonitorTraverseTag = inngest.createFunction(
  {
    id: 'kmonitor-traverse-tag',
    name: 'K-Monitor: traverse tag',
    // Conservative concurrency — the underlying httpGet enforces a 2s/host
    // gate per K-Monitor *and* per primary outlet; running too many tags
    // in parallel would still produce request bursts on shared CDN edges.
    concurrency: 2,
  },
  { event: 'kmonitor.traverse-tag' },
  async ({ event, step, logger }) => {
    const { candidateId, slug } = event.data;

    const refs = await step.run('paginate', async () =>
      paginateKMonitorTag(slug),
    );

    if (refs.length === 0) {
      await step.run('mark-empty-traversal', async () => {
        const db = getDb();
        await db
          .update(schema.kMonitorTagCandidates)
          .set({
            articleCount: 0,
            lastTraversedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.kMonitorTagCandidates.id, candidateId));
      });
      return { slug, discovered: 0, routed: 0, inserted: 0 };
    }

    // Pre-route & pre-dedup so we only fetch articles that map to a
    // supported outlet AND aren't already in the DB.
    const routable: { ref: DiscoveredArticleRef; outletSlug: string; hash: string; canonical: string }[] = [];
    for (const ref of refs) {
      const outletSlug = routeOutletByUrl(ref.sourceUrl);
      if (!outletSlug) continue;
      const adapter = getAdapter(outletSlug);
      if (!adapter) continue;
      const canonical = canonicalUrl(ref.sourceUrl, adapter.queryAllowlist);
      const hash = dedupHash(canonical);
      routable.push({ ref, outletSlug, hash, canonical });
    }

    if (routable.length === 0) {
      await step.run('mark-zero-routable', async () => {
        const db = getDb();
        await db
          .update(schema.kMonitorTagCandidates)
          .set({
            articleCount: refs.length,
            lastTraversedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.kMonitorTagCandidates.id, candidateId));
      });
      return { slug, discovered: refs.length, routed: 0, inserted: 0 };
    }

    const existingHashList = await step.run('filter-existing', async () => {
      const db = getDb();
      const found = await db
        .select({ hash: schema.newsArticles.sourceUrlHash })
        .from(schema.newsArticles)
        .where(
          inArray(
            schema.newsArticles.sourceUrlHash,
            routable.map((r) => r.hash),
          ),
        );
      return found.map((f) => f.hash);
    });
    const existingHashes = new Set(existingHashList);

    const toFetch = routable.filter((r) => !existingHashes.has(r.hash));

    const sourceIdBySlug = await step.run('load-source-ids', async () => {
      const slugs = [...new Set(toFetch.map((r) => r.outletSlug))];
      if (slugs.length === 0) return {} as Record<string, string>;
      const db = getDb();
      const rows = await db
        .select({ id: schema.sources.id, slug: schema.sources.slug })
        .from(schema.sources)
        .where(inArray(schema.sources.slug, slugs));
      return Object.fromEntries(rows.map((r) => [r.slug, r.id])) as Record<string, string>;
    });

    const insertedIds: string[] = [];
    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const batch = toFetch.slice(i, i + BATCH_SIZE);
      const batchIds = await step.run(
        `fetch-batch-${Math.floor(i / BATCH_SIZE)}`,
        async () => {
          const db = getDb();
          const ids: string[] = [];
          for (const item of batch) {
            const sourceId = sourceIdBySlug[item.outletSlug];
            if (!sourceId) {
              logger?.warn?.(
                `kmonitor.traverse-tag: no Source row for outlet ${item.outletSlug}`,
              );
              continue;
            }
            try {
              const fetched = await fetchPrimaryArticle(item.ref);
              if (!fetched) continue;
              const rows = await db
                .insert(schema.newsArticles)
                .values({
                  sourceId,
                  headline: fetched.headline,
                  excerpt: fetched.excerpt,
                  sourceUrl: item.canonical,
                  sourceUrlHash: item.hash,
                  publishedAt: fetched.publishedAt,
                  tag: fetched.tag ?? null,
                  viaArchive: fetched.viaArchive,
                })
                .onConflictDoNothing({ target: schema.newsArticles.sourceUrlHash })
                .returning({ id: schema.newsArticles.id });
              if (rows[0]) ids.push(rows[0].id);
            } catch (err) {
              const message = err instanceof Error ? err.message : 'unknown';
              logger?.warn?.(
                `kmonitor.traverse-tag: fetch failed for ${item.ref.sourceUrl}: ${message}`,
              );
            }
          }
          return ids;
        },
      );
      insertedIds.push(...batchIds);
    }
    const inserted = insertedIds.length;

    await step.run('mark-traversed', async () => {
      const db = getDb();
      await db
        .update(schema.kMonitorTagCandidates)
        .set({
          articleCount: refs.length,
          lastTraversedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.kMonitorTagCandidates.id, candidateId));
    });

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

    return {
      slug,
      discovered: refs.length,
      routed: routable.length,
      inserted,
    };
  },
);
