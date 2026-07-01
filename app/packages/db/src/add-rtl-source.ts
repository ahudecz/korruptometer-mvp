import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

async function main() {
  await db
    .insert(schema.sources)
    .values({
      slug: 'rtl',
      name: 'RTL Hírek',
      homepage: 'https://rtl.hu',
      tag: 'national',
      enabled: true,
    })
    .onConflictDoNothing({ target: schema.sources.slug });

  console.log('✅ RTL forrás hozzáadva (vagy már létezett)');
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
