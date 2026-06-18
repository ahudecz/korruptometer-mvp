import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { desc, sql } from 'drizzle-orm';
import * as schema from './schema';

async function main() {
  const db = drizzle(postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 }), { schema });

  // Összesített számok
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.newsArticles);
  console.log(`\nÖsszes cikk: ${total}`);

  // Legfrissebb 20
  const latest = await db
    .select({
      publishedAt: schema.newsArticles.publishedAt,
      tag: schema.newsArticles.tag,
      headline: schema.newsArticles.headline,
      source: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, (t) => sql`${schema.sources.id} = ${schema.newsArticles.sourceId}`)
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(20);

  console.log('\nLegfrissebb 20 cikk:');
  for (const a of latest) {
    const d = new Date(a.publishedAt).toLocaleString('hu-HU');
    console.log(`  [${a.tag ?? 'no-tag'}] ${d} | ${a.source} | ${a.headline?.slice(0, 70)}`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
