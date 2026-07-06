import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@korr/db/schema';

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

// In dev, Next.js Fast Refresh re-evaluates this module on file changes,
// which would reset a plain module-level `let` and leak a fresh 10-connection
// pool every time (the old pool's sockets are never closed) — this exhausted
// Postgres's 100-connection limit repeatedly during local testing. Caching on
// `globalThis` survives HMR module reloads within the same process, so dev
// always reuses the same pool.
const globalForDb = globalThis as unknown as { __dbClient?: DbClient };

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
export function getDb(): DbClient {
  if (globalForDb.__dbClient) return globalForDb.__dbClient;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  const sql = postgres(url, { prepare: false, max: 10 });
  const client = drizzle(sql, { schema });
  globalForDb.__dbClient = client;
  return client;
}

export { schema };
