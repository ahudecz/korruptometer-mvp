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
  // A BUILD alatt kisebb pool kell, mint futásidőben.
  //
  // 2026-09-17, mért hiba: a Next a statikus generálást több worker-
  // FOLYAMATBAN végzi, és mindegyikben újra lefut ez a modul — tehát nem egy
  // pool jön létre, hanem annyi, ahány worker. 4 worker × max 10 = 40
  // kapcsolat, miközben a Supabase pooler kerete 15. Ebből lett a
  // `EMAXCONNSESSION — max clients reached in session mode, pool_size: 15`,
  // illetve Vercelen ennek a tünete: az oldalak kapcsolatra vártak, és a
  // statikus generálás 60 másodperces limitjébe futottak
  // („Failed to build … because it took more than 60 seconds"), három
  // újrapróbálkozás után elhasalt a deploy.
  //
  // Futásidőben a 10 marad: ott egy folyamat szolgálja ki a kéréseket, és a
  // nyitóoldal ~19 párhuzamos lekérdezésének kell a hely (l. a fenti
  // kommentet a max:1 regressziójáról).
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  const sql = postgres(url, { prepare: false, max: isBuild ? 2 : 10 });
  const client = drizzle(sql, { schema });
  globalForDb.__dbClient = client;
  return client;
}

export { schema };
