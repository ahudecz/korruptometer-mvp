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

export type DetectorType = 'resignation' | 'media_closure' | 'court_verdict' | 'asset_recovery' | 'criminal_complaint';
export type CheckOutcome = 'inserted' | 'discarded';
export type CheckReason = 'low_confidence' | 'not_applicable' | 'duplicate' | 'missing_fields' | 'missing_source' | 'stale_status';

/** How many days back an unchecked article stays eligible for processing. */
export const BACKLOG_DAYS = 7;

/**
 * 2026-07-14 — a schema-required name/label field being non-empty doesn't
 * mean the LLM actually found one: when the source excerpt is too vague, it
 * sometimes improvises a placeholder ("<UNKNOWN>", "ismeretlen" stb.) that
 * passes a plain truthiness check and gets inserted as if it were real data.
 * Originally only guarded in the Telegram manual-approve path
 * (telegram-review-actions.ts) — NOT in the hourly cron detectors, which let
 * a placeholder-named duplicate ("Polt Péter felesége") slip into
 * PoliticalResignation from a second source article about an event a
 * correctly-named row already covered. Shared here so both paths use the
 * same guard and can't drift apart again (see project-detector-drift-pattern
 * in the assistant's memory for this exact class of bug).
 */
export function isPlaceholderName(value: string): boolean {
  const v = value.trim().toLowerCase().replace(/^<|>$/g, '');
  return v === '' || v === 'unknown' || v === 'ismeretlen' || v === 'n/a' || v === 'null' || v === 'undefined';
}

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

/**
 * 2026-07-13 — the LLM detectors' schemas all say "use today's date if only
 * 'today'/'recently' is mentioned", and every call site used to hand them
 * the PROCESSING date (new Date()) for that anchor. That's silently wrong
 * for any article older than the run that processes it (invisible for the
 * regular same-day scrape, but a manually-submitted Telegram tip for a
 * 6-day-old article got its relative date phrases — "kedden" — resolved
 * against today instead of the article's own publish date, landing a
 * week-old resignation on today's date). Always anchor on the ARTICLE's own
 * publishedAt, never wall-clock "now".
 */
export function articleDateIso(publishedAt: Date | string): string {
  const d = typeof publishedAt === 'string' ? new Date(publishedAt) : publishedAt;
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
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
