import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export * from './schema';
export * from './review';
export * from './watchlist';

let cachedClient: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (cachedClient) return cachedClient;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  const sql = postgres(url, {
    prepare: false,
    // Transaction Pooler (Supavisor) mögé max:1 szeriálissá teszi a Promise.all-t.
    // max:5 engedi a valódi párhuzamosságot, a pooler kezeli a backend-oldalon.
    max: 5,
  });
  cachedClient = drizzle(sql, { schema });
  return cachedClient;
}

export type Database = ReturnType<typeof db>;
