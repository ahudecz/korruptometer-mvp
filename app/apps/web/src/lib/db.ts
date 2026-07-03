import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@korr/db/schema';

let cachedClient: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Single Postgres connection pool used by all server-side route handlers and
 * server components. Pool is sized to 1 because Vercel functions are short-lived
 * and we connect through Supabase pgbouncer (transaction mode).
 */
export function getDb() {
  if (cachedClient) return cachedClient;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  const sql = postgres(url, { prepare: false, max: 1 });
  cachedClient = drizzle(sql, { schema });
  return cachedClient;
}

export { schema };
