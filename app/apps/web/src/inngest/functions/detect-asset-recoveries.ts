import 'server-only';
import { and, desc, gte, sql } from 'drizzle-orm';

import { detectAssetRecoveryFromArticle } from '@korr/db/ai-assets';
import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

const BATCH_SIZE = 20;
const LOOKBACK_MS = 2 * 60 * 60 * 1000;

const ASSET_KEYWORDS = [
  'visszafizet', 'visszaszerz', 'vagyonelkobzás', 'elkobzás', 'lefoglalt',
  'kártérítés', 'visszatérít', 'megtérít', 'visszaadás', 'visszaadja',
  'bírság', 'kötbér', 'visszakövetel', 'közpénz', 'közjavak',
  'állami kár', 'kárösszeg', 'vagyoni kár', 'kompenzáció',
];

/**
 * asset.detect — cron every hour (offset 45 min).
 * Scans recent articles for public asset recoveries and auto-inserts
 * confirmed rows into AssetRecovery.
 */
export const detectAssetRecoveries = inngest.createFunction(
  { id: 'detect-asset-recoveries', name: 'Detect public asset recoveries', concurrency: 1 },
  { cron: '45 * * * *' },
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
      return ASSET_KEYWORDS.some((kw) => text.includes(kw));
    });

    if (candidates.length === 0) return { scanned: articles.length, inserted: 0 };

    let inserted = 0;

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE);

      const batchInserted = await step.run(`process-batch-${batchNum}`, async () => {
        let count = 0;
        for (const article of batch) {
          const result = await detectAssetRecoveryFromArticle(
            article.headline,
            article.excerpt,
            todayIso,
          );

          if (!result || !result.isRecovery || result.confidence < 0.7) continue;
          if (!result.caseLabel || !result.description) continue;

          // Dedup: skip if same caseLabel already recorded in last 14 days.
          const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
          const existing = await db
            .select({ id: schema.assetRecoveries.id })
            .from(schema.assetRecoveries)
            .where(
              and(
                sql`lower(${schema.assetRecoveries.caseLabel}) = lower(${result.caseLabel})`,
                gte(schema.assetRecoveries.createdAt, fourteenDaysAgo),
              ),
            )
            .limit(1);

          if (existing.length > 0) continue;

          const fallbackDate = new Date(article.publishedAt as unknown as string);
          let recoveredAt: Date;
          try {
            recoveredAt = new Date(result.recoveredAt);
            if (isNaN(recoveredAt.getTime())) recoveredAt = fallbackDate;
          } catch {
            recoveredAt = fallbackDate;
          }

          // Generate a deterministic caseId from the label + date.
          const caseId = result.caseLabel
            .toLowerCase()
            .replace(/[^a-záéíóöőúüű0-9]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80);

          await db.insert(schema.assetRecoveries).values({
            caseId,
            caseLabel: result.caseLabel.slice(0, 200),
            description: result.description.slice(0, 1000),
            amountFt: BigInt(Math.round(result.amountFt)),
            recoveredAt,
            sourceUrl: article.sourceUrl ?? null,
            sourceName: null,
          });

          count++;
        }
        return count;
      });

      inserted += batchInserted;
    }

    logger?.info?.(`asset.detect: scanned=${articles.length} candidates=${candidates.length} inserted=${inserted}`);
    return { scanned: articles.length, candidates: candidates.length, inserted };
  },
);
