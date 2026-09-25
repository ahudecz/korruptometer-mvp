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
  // A 6 MÉRT érték, nem tipp. A 2 túl szoros volt: a /podcastok lap egyetlen
  // renderelés alatt hét lekérdezést indít párhuzamosan (videók +
  // getMonitoredNames három kérdése + reelek + cross-promo), és két
  // kapcsolaton ezek egymásra vártak — pontosan ezért lépte túl a 60
  // másodperces limitet a 36a571a és az 1be526f build. A 6 mellett ez a lap
  // nem torlódik, és mivel a statikus generálás EGY workerben fut
  // (next.config.js staticGenerationMinPagesPerWorker), a build alatt
  // összesen 6 kapcsolat nyílik a pooler 15-ös keretéből.
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  // 2026-09-25: az időszakos 20+ mp-es nyitóoldal-betöltés oka. Az éles
  // DATABASE_URL a Supabase pooler SESSION módja (5432-es port, pool_size 15):
  // ott minden kliens-kapcsolat egy teljes szerver-slotot foglal, amíg él. A
  // postgres.js alapból SOSEM zárja az üresjárati kapcsolatot (idle_timeout 0),
  // így egy meleg Vercel-példány a nyitóoldal egyetlen renderelése után 10
  // slotot tart magánál percekig. A második példány (hidegindítás, cron,
  // Inngest-függvény) már csak 5 szabadot talál, a többi lekérdezése sorban
  // áll, amíg valami fel nem szabadul — ez a „nem tölt be" tünet.
  // idle_timeout: 20 mp üresjárat után visszaadjuk a slotot; max_lifetime:
  // 5 percnél tovább egy kapcsolat sem él; connect_timeout: ha nincs szabad
  // slot, 10 mp után hibázunk ahelyett, hogy a 60 mp-es limitig lógnánk.
  const sql = postgres(url, {
    prepare: false,
    max: isBuild ? 6 : 10,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
  });
  const client = drizzle(sql, { schema });
  globalForDb.__dbClient = client;
  return client;
}

export { schema };
