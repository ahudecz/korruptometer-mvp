import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@korr/db/schema';

let cachedClient: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Postgres connection pool used by all server-side route handlers and server
 * components, via Supabase pgbouncer (transaction mode). max:1 previously
 * forced every Promise.all() query on the homepage (~19 queries) onto a
 * single connection, serializing what was meant to run concurrently — the
 * likely cause of the repeated 60s FUNCTION_INVOCATION_TIMEOUT on `/`.
 * Transaction-mode pgbouncer is designed to multiplex many short-lived
 * transactions from one client, so a small pool (not 1) lets Promise.all
 * actually run in parallel.
 */
export function getDb() {
  if (cachedClient) return cachedClient;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  const sql = postgres(url, { prepare: false, max: 10 });
  cachedClient = drizzle(sql, { schema });
  return cachedClient;
}

export { schema };
