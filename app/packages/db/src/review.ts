/**
 * 003-detection-review-engine — review decision logic.
 *
 * Pure, testable rules that route each LLM detection to auto-publish, the
 * editorial review queue, or discard. See specs/003-detection-review-engine.
 */
import { sql } from 'drizzle-orm';
import { normalizeName } from './watchlist';

export type ReviewDecision = 'approved' | 'pending' | 'discard';

export const AUTO_PUBLISH_THRESHOLD = 0.9; // FR-003
export const REVIEW_FLOOR = 0.7; // FR-004 / FR-005
export const DEDUP_WINDOW_DAYS = 30; // FR-009

/**
 * Decide what to do with a detection.
 *
 *   confidence < 0.70           → 'discard'   (FR-005, universal floor)
 *   confidence >= 0.90          → 'approved'  (FR-003, watchlist included)
 *   0.70 <= confidence < 0.90   → 'pending'   (FR-004)
 */
export function decideStatus(confidence: number, _isWatchlist: boolean): ReviewDecision {
  if (confidence < REVIEW_FLOOR) return 'discard';
  if (confidence >= AUTO_PUBLISH_THRESHOLD) return 'approved';
  return 'pending';
}

/** Tables the dedup guard understands (name column varies per table). */
export type DedupTable =
  | { table: 'PoliticalResignation'; nameColumn: 'name' }
  | { table: 'MediaClosure'; nameColumn: 'name' }
  | { table: 'CourtVerdict'; nameColumn: 'personName' };

type Executable = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

/**
 * True if a row with the same normalised name already exists in the table
 * within the dedup window, in ANY reviewStatus (approved/pending/rejected).
 * Institution is intentionally ignored, and rejected rows count, so a
 * previously rejected detection is not re-created (FR-009, FR-011).
 *
 * The SQL side re-derives the same normalisation as normalizeName() —
 * lower + unaccent + punctuation-to-space + collapse/trim — so that e.g.
 * "Promenad24" and "Promenad24.hu" or "Kovács Zoltán!" and "Kovács Zoltán"
 * are recognised as the same name (research.md called this "írásjel-toleráns"
 * matching, but the query previously only lower/unaccent/trimmed the raw
 * strings, so punctuation differences slipped past the guard).
 */
export async function isDuplicate(
  db: Executable,
  target: DedupTable,
  name: string,
  withinDays: number = DEDUP_WINDOW_DAYS,
): Promise<boolean> {
  const key = normalizeName(name);
  if (!key) return false;
  const tableId = sql.identifier(target.table);
  const nameCol = sql.identifier(target.nameColumn);
  const rows = (await db.execute(sql`
    SELECT 1 FROM ${tableId}
    WHERE trim(regexp_replace(lower(unaccent(trim(${nameCol}))), '[^a-z0-9]+', ' ', 'g')) = ${key}
      AND "createdAt" >= now() - make_interval(days => ${withinDays})
    LIMIT 1
  `)) as unknown as { length: number };
  return rows.length > 0;
}
