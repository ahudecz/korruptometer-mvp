import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import { ilike, or } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

async function main() {
  const updated = await db
    .update(schema.newsArticles)
    .set({ tag: 'Balásy Gyula', featured: true })
    .where(
      or(
        ilike(schema.newsArticles.headline, '%balásy%'),
        ilike(schema.newsArticles.excerpt, '%balásy%'),
      ),
    )
    .returning({ id: schema.newsArticles.id, headline: schema.newsArticles.headline });

  console.log(`✅ ${updated.length} Balásy cikk frissítve:`);
  for (const r of updated) console.log(`  • ${r.headline}`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
