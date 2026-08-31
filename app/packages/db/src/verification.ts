/**
 * 010-post-publish-verification — cross-outlet corroboration search + the
 * pure decision rule for whether a verification result can be auto-applied.
 *
 * `findCorroboratingArticle` mirrors `findExistingComplaint()`'s two-tier
 * pg_trgm approach (see review.ts), but here there is no cheap exact-match
 * tier worth trying first — the corroborating article is, by definition, a
 * DIFFERENT outlet's independent write-up of the same event, so its
 * headline/excerpt wording is expected to differ from the record's own
 * entity name. Only the word_similarity() fuzzy tier applies.
 */
import { sql } from 'drizzle-orm';

type Executable = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

/** Below this, the fuzzy word_similarity() score is not considered a match at all. */
export const CORROBORATION_SIMILARITY_FLOOR = 0.4;

/** Below this confidence, an otherwise-successful verification is NOT auto-applied — see decideVerificationAction. */
export const VERIFICATION_CONFIDENCE_FLOOR = 0.85;

export type CorroboratingArticle = {
  headline: string;
  excerpt: string;
  sourceUrl: string;
  sourceName: string;
};

/**
 * Searches the already-scraped `NewsArticle` table (no new scrape triggered)
 * for an article from a DIFFERENT outlet than `excludeSourceSlugs`, published
 * within ±3 days of `eventDateIso`, whose headline/excerpt best matches
 * `entityName`. Returns the best candidate if its word_similarity score
 * clears `CORROBORATION_SIMILARITY_FLOOR`, otherwise null.
 */
export async function findCorroboratingArticle(
  db: Executable,
  entityName: string,
  eventDateIso: string,
  excludeSourceSlugs: string[],
): Promise<CorroboratingArticle | null> {
  if (!entityName.trim()) return null;
  const rows = (await db.execute(sql`
    SELECT
      a."headline",
      a."excerpt",
      a."sourceUrl",
      s."name" AS "sourceName",
      GREATEST(
        word_similarity(${entityName}, a."headline"),
        word_similarity(${entityName}, a."excerpt")
      ) AS "wsim"
    FROM "NewsArticle" a
    JOIN "Source" s ON s.id = a."sourceId"
    WHERE s."slug" != ALL(${excludeSourceSlugs})
      AND a."publishedAt" BETWEEN (${eventDateIso}::timestamptz - interval '3 days')
                              AND (${eventDateIso}::timestamptz + interval '3 days')
    ORDER BY "wsim" DESC
    LIMIT 1
  `)) as unknown as Array<CorroboratingArticle & { wsim: number }>;

  const best = rows[0];
  if (!best || best.wsim < CORROBORATION_SIMILARITY_FLOOR) return null;
  return { headline: best.headline, excerpt: best.excerpt, sourceUrl: best.sourceUrl, sourceName: best.sourceName };
}

export type VerificationLlmResult = {
  action: 'no_change' | 'correct' | 'delete';
  confidence: number;
};

/**
 * `apply` only when the LLM both wants to change something AND is
 * confident about it — a low-confidence `correct`/`delete` result routes to
 * the SAME human-approval path as "no corroborating article found" (see
 * spec.md Phase 0 "saját bizonytalanság" decision). This keeps the verifier
 * itself from becoming a second, equally-unreliable LLM failure mode.
 */
export function decideVerificationAction(result: VerificationLlmResult): 'apply' | 'needs_approval' {
  if (result.action === 'no_change') return 'apply';
  return result.confidence >= VERIFICATION_CONFIDENCE_FLOOR ? 'apply' : 'needs_approval';
}

/**
 * True when the MOST RECENT VerificationCheck row for this target is an
 * unanswered `pending_approval` — used to skip re-notifying Telegram every
 * hour for the same unresolved item while a human hasn't pressed
 * Igen/Nem yet. Once answered, the `vy`/`vn` webhook branch writes a new
 * terminal row (`approved_by_human`) or deletes the record entirely (`vn`),
 * so this naturally stops returning true without any extra bookkeeping.
 */
export async function hasOutstandingApproval(
  db: Executable,
  targetTable: string,
  targetId: string,
): Promise<boolean> {
  const rows = (await db.execute(sql`
    SELECT "outcome" FROM "VerificationCheck"
    WHERE "targetTable" = ${targetTable} AND "targetId" = ${targetId}
    ORDER BY "checkedAt" DESC
    LIMIT 1
  `)) as unknown as Array<{ outcome: string }>;
  return rows[0]?.outcome === 'pending_approval';
}
