/**
 * 006-detection-pipeline-reliability — backlog-safe scan + audit trail for
 * the four LLM detectors (resignations, media closures, court verdicts,
 * asset recoveries).
 *
 * Replaces each detector's fixed 2h rolling window with a "has a REAL
 * (non-transient) decision been made about this article yet" check. A
 * transient LLM/API failure must never call markChecked() — that is the
 * entire mechanism: an unrecorded article stays eligible and is
 * automatically retried on the next hourly run instead of silently
 * disappearing once it ages out of a time window.
 */
import { sql } from 'drizzle-orm';
import type { LlmResult } from './llm';

export type DetectorType = 'resignation' | 'media_closure' | 'court_verdict' | 'asset_recovery';
export type CheckOutcome = 'inserted' | 'discarded';
export type CheckReason = 'low_confidence' | 'not_applicable' | 'duplicate' | 'missing_fields' | 'missing_source';

/** How many days back an unchecked article stays eligible for processing. */
export const BACKLOG_DAYS = 7;

/**
 * "Near miss" confidence band surfaced in the monthly digest — below the
 * review.ts REVIEW_FLOOR (0.70) so these were correctly discarded per the
 * existing 003 rules, but close enough to be worth a second human look.
 * Purely a digest-visibility band; does NOT change decideStatus's routing.
 */
export const NEAR_MISS_MIN = 0.5;
export const NEAR_MISS_MAX = 0.6999;

type Executable = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

/**
 * True when an LlmResult's null `data` means the HTTP call itself never
 * completed (API outage, rate limit, credit/budget exhaustion — zero tokens
 * counted), as opposed to a successful call that genuinely found no match.
 * Detectors MUST skip markChecked() when this is true, so the article stays
 * eligible for retry on the next run (FR-002).
 */
export function isTransientLlmFailure(result: LlmResult<unknown>): boolean {
  return result.data === null && result.inputTokens === 0 && result.outputTokens === 0;
}

export type CandidateArticle = {
  id: string;
  headline: string;
  excerpt: string;
  publishedAt: string;
  sourceUrl: string | null;
  sourceName: string | null;
};

/**
 * All NewsArticle rows within the backlog window that this detector has not
 * yet reached a terminal decision on (no DetectionCheck row exists for this
 * article+detectorType pair). Callers still apply their own keyword
 * pre-filter on top of this — this only replaces the time-window/backlog
 * layer, not the relevance filter.
 *
 * Joins Source for sourceName so every detector can attach a real citation —
 * a resignation/closure/verdict/recovery entry MUST NOT be published without
 * a source link (see FR in the callers' "missing source" discard gate).
 */
export async function loadUncheckedArticles(
  db: Executable,
  detectorType: DetectorType,
  backlogDays: number = BACKLOG_DAYS,
): Promise<CandidateArticle[]> {
  return (await db.execute(sql`
    SELECT a.id, a.headline, a.excerpt, a."publishedAt", a."sourceUrl", s.name AS "sourceName"
    FROM "NewsArticle" a
    LEFT JOIN "Source" s ON s.id = a."sourceId"
    WHERE a."publishedAt" >= now() - make_interval(days => ${backlogDays})
      AND NOT EXISTS (
        SELECT 1 FROM "DetectionCheck" dc
        WHERE dc."articleId" = a.id AND dc."detectorType" = ${detectorType}
      )
    ORDER BY a."publishedAt" DESC
    LIMIT 200
  `)) as unknown as CandidateArticle[];
}

/**
 * Records a REAL terminal decision for one (article, detector) pair —
 * either the candidate became a public/pending row (`outcome: 'inserted'`)
 * or was legitimately discarded (`outcome: 'discarded'` + a specific
 * `reason`). NEVER call this from an LLM/API-error catch branch: leaving no
 * row is what makes the article eligible for retry on the next run.
 */
export async function markChecked(
  db: Executable,
  opts: {
    articleId: string;
    detectorType: DetectorType;
    outcome: CheckOutcome;
    reason?: CheckReason;
    extractedName?: string;
    confidence?: number;
  },
): Promise<void> {
  await db.execute(sql`
    INSERT INTO "DetectionCheck"
      ("articleId", "detectorType", outcome, reason, "extractedName", confidence)
    VALUES (
      ${opts.articleId}, ${opts.detectorType}, ${opts.outcome},
      ${opts.reason ?? null}, ${opts.extractedName ?? null}, ${opts.confidence ?? null}
    )
    ON CONFLICT ("articleId", "detectorType") DO NOTHING
  `);
}
