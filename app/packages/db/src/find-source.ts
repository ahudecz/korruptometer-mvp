import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

async function main() {
  const db = drizzle(postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 }), { schema });
  const r = await db.select({ id: schema.sources.id, name: schema.sources.name, homepage: schema.sources.homepage }).from(schema.sources).limit(80);
  for (const s of r) console.log(`${s.name} | ${s.homepage}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
