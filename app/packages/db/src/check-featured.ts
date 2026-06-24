import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql, eq } from 'drizzle-orm';
import * as schema from './schema';

async function main() {
  const db = drizzle(postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 }), { schema });
  const [a = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.newsArticles).where(eq(schema.newsArticles.featured, true));
  const [b = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.newsArticles).where(eq(schema.newsArticles.featured, false));
  console.log(`featured=true: ${a.n}   featured=false: ${b.n}`);

  // Minta a featured=false cikkekből
  const sample = await db
    .select({ headline: schema.newsArticles.headline, tag: schema.newsArticles.tag })
    .from(schema.newsArticles)
    .where(eq(schema.newsArticles.featured, false))
    .limit(10);
  console.log('\nMinta featured=false cikkek:');
  for (const s of sample) console.log(`  [${s.tag}] ${s.headline?.slice(0, 80)}`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
