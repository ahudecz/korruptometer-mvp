import 'server-only';
import * as Sentry from '@sentry/nextjs';
import Anthropic from '@anthropic-ai/sdk';
import { and, eq, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { getExtractorVersion } from '@/lib/investigation/extractor-version';
import {
  extractClaimsFromArticle,
  type ExtractArticleInput,
} from '@/lib/investigation/extract-prompt';
import {
  estimateHufSpend,
  probeDailySpend,
  recordDailySpend,
} from '@/lib/investigation/llm-spend';
import { isBypassActive } from '@/lib/cron-bypass';
import { inngest } from '../client';

type TxClient = Parameters<
  Parameters<ReturnType<typeof getDb>['transaction']>[0]
>[0];

async function fetchArticleForExtraction(
  source: 'news' | 'kmonitor',
  id: string,
): Promise<ExtractArticleInput | null> {
  const db = getDb();
  if (source === 'news') {
    const row = await db
      .select({
        headline: schema.newsArticles.headline,
        excerpt: schema.newsArticles.excerpt,
        sourceUrl: schema.newsArticles.sourceUrl,
      })
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.id, id))
      .limit(1);
    if (!row[0]) return null;
    return {
      headline: row[0].headline,
      body: row[0].excerpt,
      sourceUrl: row[0].sourceUrl,
    };
  }
  // K-Monitor side: NewsId is the integer PK. We use the headline and
  // any HF-fetched body. Failing to fetch HF leaves the headline alone.
  const newsId = Number.parseInt(id, 10);
  if (!Number.isFinite(newsId)) return null;
  const row = await db
    .select({
      title: schema.kMonitorArticles.title,
      sourceUrl: schema.kMonitorArticles.sourceUrl,
    })
    .from(schema.kMonitorArticles)
    .where(eq(schema.kMonitorArticles.newsId, newsId))
    .limit(1);
  if (!row[0]) return null;
  const hfBody = await fetchKMonitorBody(newsId);
  return {
    headline: row[0].title,
    body: hfBody ?? row[0].title,
    sourceUrl: row[0].sourceUrl,
  };
}

async function fetchKMonitorBody(newsId: number): Promise<string | null> {
  const base =
    process.env.HF_DATASET_BASE ?? 'https://datasets-server.huggingface.co';
  const url =
    `${base}/filter?dataset=K-Monitor/kmdb_base&config=default&split=train`
    + `&where=news_id%3D${encodeURIComponent(String(newsId))}`
    + `&offset=0&length=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      rows?: { row: { text?: string } }[];
    };
    return json.rows?.[0]?.row?.text ?? null;
  } catch {
    return null;
  }
}

/**
 * investigation.extract-claims (T018, FR-001..FR-007).
 *
 * Triggered by `investigation.article.ingested` after the news scraper or
 * K-Monitor harvester writes a new article. The function:
 *
 *   1. Probes ArticleExtractionRun for an existing row at
 *      `(articleSource, articleId, extractorVersion)` (FR-002 / FR-003).
 *   2. Probes DailyLlmUsage for today's spend; if at/over the ceiling,
 *      emits `investigation.extraction.paused` and returns without a call
 *      (FR-005).
 *   3. Calls Anthropic Haiku 4.5 with structured output (research.md §1).
 *   4. Validates every claim has evidenceQuote+sourceUrl+paragraphLocator
 *      (FR-036) — already done in `extractClaimsFromArticle`.
 *   5. Writes ArticleClaim rows + ArticleExtractionRun + DailyLlmUsage
 *      upsert inside one Postgres transaction (FR-002 idempotency).
 *   6. Emits `investigation.claims.extracted` (claimIds may be empty).
 */
export const investigationExtractClaims = inngest.createFunction(
  {
    id: 'investigation.extract-claims',
    concurrency: [
      { key: 'event.data.articleId', limit: 1 },
      { limit: parseInt(process.env.EXTRACTION_CONCURRENCY ?? '2', 10) },
    ],
    retries: 3,
  },
  { event: 'investigation.article.ingested' },
  async ({ event, step, logger }) => {
    if (isBypassActive()) {
      logger?.info?.('investigation.extract-claims: skipped — PIPELINE_BYPASS_INNGEST active (Inngest event bus untrusted during the outage)');
      return { skipped: 'inngest_bypass_active' };
    }
    const { articleSource, articleId } = event.data;
    const extractorVersion = getExtractorVersion();
    const model =
      process.env.INVESTIGATION_EXTRACTOR_MODEL ?? 'claude-haiku-4-5';

    Sentry.addBreadcrumb({
      category: 'investigation.extract',
      message: 'investigation.extract-claims.start',
      data: { articleSource, articleId, extractorVersion },
    });

    // 1. Idempotency probe.
    const existing = await step.run('probe-existing', async () => {
      const db = getDb();
      const rows = await db
        .select({ claimCount: schema.articleExtractionRuns.claimCount })
        .from(schema.articleExtractionRuns)
        .where(
          and(
            eq(schema.articleExtractionRuns.articleSource, articleSource),
            eq(schema.articleExtractionRuns.articleId, articleId),
            eq(
              schema.articleExtractionRuns.extractorVersion,
              extractorVersion,
            ),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    });
    if (existing) {
      return {
        skipped: 'idempotent',
        extractorVersion,
        claimCount: existing.claimCount,
      };
    }

    // 2. Daily-ceiling probe — open a short txn so the FOR UPDATE lock
    //    is held only while we make the decision.
    const probe = await step.run('probe-daily-ceiling', async () => {
      const db = getDb();
      return db.transaction(async (tx) => probeDailySpend(tx, model));
    });
    if (probe.paused) {
      await step.sendEvent('emit-paused', {
        name: 'investigation.extraction.paused',
        data: {
          day: new Date().toISOString().slice(0, 10),
          model,
          estimatedHufSpend: probe.currentSpendHuf,
          ceilingHuf: probe.ceilingHuf,
        },
      });
      Sentry.addBreadcrumb({
        category: 'investigation.extract',
        message: 'investigation.extract-claims.paused',
        data: {
          articleSource,
          articleId,
          currentSpendHuf: probe.currentSpendHuf,
          ceilingHuf: probe.ceilingHuf,
        },
      });
      return { skipped: 'daily_ceiling', currentSpendHuf: probe.currentSpendHuf };
    }

    // 3. Fetch article text.
    const article = await step.run('fetch-article', async () =>
      fetchArticleForExtraction(articleSource, articleId),
    );
    if (!article) {
      return { skipped: 'article_missing' };
    }

    // 4. Anthropic call — kept inside step.run so retries are durable.
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }
    const result = await step.run('call-anthropic', async () => {
      const client = new Anthropic({ apiKey });
      return extractClaimsFromArticle(client, article);
    });

    // 5. Atomic write — claims + extraction-run marker + usage upsert.
    const claimIds = await step.run('persist-extraction', async () => {
      const db = getDb();
      const estimated = estimateHufSpend(
        result.inputTokens,
        result.outputTokens,
      );
      return db.transaction(async (tx) => persist(
        tx,
        articleSource,
        articleId,
        extractorVersion,
        result,
        estimated,
        article.sourceUrl,
        model,
      ));
    });

    // 6. Emit downstream event (claimIds may be []).
    await step.sendEvent('emit-claims-extracted', {
      name: 'investigation.claims.extracted',
      data: {
        articleSource,
        articleId,
        claimIds,
        extractorVersion,
      },
    });

    return { claimIds, extractorVersion, claimCount: claimIds.length };
  },
);

async function persist(
  tx: TxClient,
  articleSource: 'news' | 'kmonitor',
  articleId: string,
  extractorVersion: string,
  result: Awaited<ReturnType<typeof extractClaimsFromArticle>>,
  estimatedHufSpend: string,
  fallbackSourceUrl: string,
  model: string,
): Promise<string[]> {
  // Insert the run marker first. The PRIMARY KEY enforces idempotency:
  // if a parallel invocation raced us, this throws a unique-violation
  // and the txn rolls back — the caller's retry logic kicks in.
  await tx.insert(schema.articleExtractionRuns).values({
    articleSource,
    articleId,
    extractorVersion,
    claimCount: result.claims.length,
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    estimatedHufSpend,
  });

  // Insert each claim. claimOrdinal is 1-based per data-model.md.
  const insertedIds: string[] = [];
  for (let i = 0; i < result.claims.length; i += 1) {
    const c = result.claims[i]!;
    const ord = i + 1;
    const inserted = (await tx
      .insert(schema.articleClaims)
      .values({
        articleSource,
        articleId,
        claimOrdinal: ord,
        extractorVersion,
        mechanism: c.mechanism,
        allegedAmountHuf:
          c.allegedAmountHuf == null ? null : BigInt(c.allegedAmountHuf),
        amountBasis: c.amountBasis,
        parties: c.parties as unknown as Record<string, unknown>,
        evidenceQuote: c.evidenceQuote,
        sourceUrl: c.sourceUrl || fallbackSourceUrl,
        paragraphLocator: c.paragraphLocator,
        model,
        confidence: c.confidence,
      })
      .returning({ id: schema.articleClaims.id })) as Array<{ id: string }>;
    if (inserted[0]) insertedIds.push(inserted[0].id);
  }

  await recordDailySpend(
    tx,
    model,
    result.inputTokens,
    result.outputTokens,
    estimatedHufSpend,
  );
  void sql;
  return insertedIds;
}
