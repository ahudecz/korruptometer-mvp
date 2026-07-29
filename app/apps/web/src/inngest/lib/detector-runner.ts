import 'server-only';

import { fetchArticleBodyTransient } from '@korr/scrapers';
import {
  articleDateIso,
  isTransientLlmFailure,
  loadUncheckedArticles,
  type CandidateArticle,
  type DetectorType,
} from '@korr/db';
import type { LlmResult } from '@korr/db/llm';
import { getDb } from '@/lib/db';
import { isBypassActive, type BypassStep, type BypassLogger } from '@/lib/cron-bypass';
import { inngest } from '../client';

const BATCH_SIZE = 20;

/**
 * Wraps an Inngest cron function with the PIPELINE_BYPASS_INNGEST guard that
 * every detector needs identically (see cron-bypass.ts header): when the
 * bypass is active, the Vercel cron route calls `core` directly and this
 * Inngest-triggered copy must no-op, so the work never runs twice.
 */
export function createBypassGuardedFunction(
  config: { id: string; name: string; cron: string },
  core: (args: { step: BypassStep; logger?: BypassLogger }) => Promise<unknown>,
) {
  return inngest.createFunction(
    { id: config.id, name: config.name, concurrency: 1 },
    { cron: config.cron },
    async ({ step, logger }) => {
      if (isBypassActive()) {
        logger?.info?.(`${config.id}: skipped — PIPELINE_BYPASS_INNGEST active, Vercel cron owns this run`);
        return { skipped: 'inngest_bypass_active' };
      }
      return core({ step: step as unknown as BypassStep, logger });
    },
  );
}

export type ArticleProcessResult = { inserted: boolean; approved: boolean };

/**
 * Shared batch harness for the article-scanning LLM detectors (resignations,
 * verdicts, media closures, asset recoveries, criminal complaints — NOT
 * detect-watchlist-removals, which loops WATCH_LIST people, not articles, so
 * it doesn't fit this shape).
 *
 * Centralizes the mechanics that used to be copy-pasted five times: loading
 * the unchecked-article backlog, the keyword pre-filter, the step.run batch
 * loop, skipping markChecked on a transient LLM failure so the article is
 * retried next run, and the "seems incomplete → refetch the full article
 * body once and retry" pattern (see the original 2026-07-24 comment in
 * detect-resignations.ts for why that retry exists). Everything
 * detector-specific — field validation, dedup rules, insert/update,
 * markChecked, notifications — stays in the caller's `processArticle`
 * callback, which is the only part that actually differs between detectors.
 */
export async function runArticleDetectionBatch<TResult>({
  step,
  logger,
  detectorType,
  keywords,
  callLlm,
  isIncomplete,
  processArticle,
  logLabel,
}: {
  step: BypassStep;
  logger?: BypassLogger;
  detectorType: DetectorType;
  keywords: string[];
  callLlm: (headline: string, excerpt: string, dateIso: string) => Promise<LlmResult<TResult>>;
  isIncomplete: (result: TResult | null) => boolean;
  processArticle: (article: CandidateArticle, result: TResult | null) => Promise<ArticleProcessResult>;
  logLabel: string;
}): Promise<{ scanned: number; candidates: number; inserted: number }> {
  const db = getDb();

  const articles = await step.run('load-unchecked-articles', () => loadUncheckedArticles(db, detectorType));
  if (articles.length === 0) return { scanned: 0, candidates: 0, inserted: 0 };

  const candidates = articles.filter((a) => {
    const text = `${a.headline} ${a.excerpt}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  });
  if (candidates.length === 0) return { scanned: articles.length, candidates: 0, inserted: 0 };

  let inserted = 0;
  let approvedInserted = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE);

    const batchResult = await step.run(`process-batch-${batchNum}`, async () => {
      let count = 0;
      let approvedCount = 0;
      for (const article of batch) {
        const llmResult = await callLlm(article.headline, article.excerpt, articleDateIso(article.publishedAt));

        // Transient (API/network/credit) failure — leave unrecorded so the
        // article stays eligible and is retried on the next hourly run.
        if (isTransientLlmFailure(llmResult)) continue;

        let result = llmResult.data;
        if (isIncomplete(result) && article.sourceUrl) {
          const bodyText = await fetchArticleBodyTransient(article.sourceUrl).catch(() => null);
          if (bodyText && bodyText.length > article.excerpt.length) {
            const retryResult = await callLlm(article.headline, bodyText, articleDateIso(article.publishedAt));
            if (!isTransientLlmFailure(retryResult) && retryResult.data) {
              result = retryResult.data;
            }
          }
        }

        const outcome = await processArticle(article, result);
        if (outcome.inserted) count++;
        if (outcome.approved) approvedCount++;
      }
      return { count, approvedCount };
    });

    inserted += batchResult.count;
    approvedInserted += batchResult.approvedCount;
  }

  // Only a publicly-visible (approved) insert can change what's breaking —
  // a 'pending' row awaiting Telegram review isn't live yet.
  if (approvedInserted > 0) {
    await step.sendEvent('emit-breaking-recompute', {
      name: 'breaking.recompute',
      data: { reason: detectorType },
    });
  }

  logger?.info?.(`${logLabel}: scanned=${articles.length} candidates=${candidates.length} inserted=${inserted}`);
  return { scanned: articles.length, candidates: candidates.length, inserted };
}
