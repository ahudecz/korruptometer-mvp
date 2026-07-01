import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

/**
 * Optimistic-concurrency helper for state-changing investigation writes
 * (FR-031c, research.md §6). Performs:
 *
 *   UPDATE <table>
 *      SET <mutation fields>, updatedAt = now()
 *    WHERE id = $id AND updatedAt = $expectedUpdatedAt
 *    RETURNING updatedAt
 *
 * If the row's `updatedAt` advanced between the reviewer's page load and
 * the click, the UPDATE matches zero rows and we throw `StaleRowError`.
 * The route handler should translate this into a `409 stale` response.
 */
export class StaleRowError extends Error {
  constructor(public table: string, public id: string) {
    super(`Optimistic concurrency conflict on ${table}#${id}`);
    this.name = 'StaleRowError';
  }
}

type TableWithIdAndUpdatedAt = PgTable & {
  id: PgColumn;
  updatedAt: PgColumn;
  _: { name: string };
};

// The `db` parameter is intentionally `unknown`-typed at the call site
// (we accept either the pooled Drizzle client or a `tx` transaction
// inside `db.transaction(async (tx) => …)`). We narrow internally via
// `any` so the chain composes without exposing Drizzle's verbose
// generics on every caller.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDrizzle = any;

export async function withOptimisticUpdate<T extends TableWithIdAndUpdatedAt>(
  db: AnyDrizzle,
  table: T,
  id: string,
  expectedUpdatedAt: Date,
  mutation: Record<string, unknown>,
): Promise<Date> {
  const result = (await db
    .update(table)
    .set({ ...mutation, updatedAt: sql`now()` })
    .where(and(eq(table.id, id), eq(table.updatedAt, expectedUpdatedAt)))
    .returning({ updatedAt: table.updatedAt })) as Array<{ updatedAt: Date }>;
  if (result.length === 0) {
    throw new StaleRowError(table._.name, id);
  }
  return result[0]!.updatedAt;
}
