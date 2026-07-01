import 'server-only';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';

/**
 * Per-source-system advisory-lock wrapper (FR-016).
 *
 * Wraps the provided async function inside a short Postgres transaction
 * that takes `pg_advisory_xact_lock(hashtext('external-fetch:<source>'))`
 * — meaning every adapter call against a given source system is
 * serialised across all Inngest function instances. The 2-second
 * per-host gate is enforced inside each adapter via this same wrapper:
 * when the call's wall-clock duration is below the gate threshold, we
 * `setTimeout` for the remainder *after* the txn closes so the lock is
 * not held idle.
 */
export async function withSourceSystemLock<T>(
  sourceSystem: string,
  perHostGateMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const db = getDb();
  const startedAt = Date.now();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(hashtext(${'external-fetch:' + sourceSystem}))
    `);
    return fn();
  });
  // Enforce the per-host gate *after* releasing the lock so a fast
  // source doesn't block its own lock for two seconds.
  const elapsed = Date.now() - startedAt;
  if (perHostGateMs > 0 && elapsed < perHostGateMs) {
    await new Promise((res) => setTimeout(res, perHostGateMs - elapsed));
  }
  return result;
}
