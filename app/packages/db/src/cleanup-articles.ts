/**
 * Egyszeri cleanup — törli az irreleváns híreket az adatbázisból.
 * A relevantByDefault forrásokból (atlatszo, direkt36 stb.) minden cikk marad.
 * A többi forrásnál a kulcsszószűrő dönti el.
 * Használat: pnpm --filter @korr/db cleanup-articles
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import { inArray } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import { isRelevant } from '@korr/scrapers';

const RELEVANT_BY_DEFAULT_SLUGS = new Set([
  'atlatszo',
  'direkt36',
  'kontroll',
  'valasz',
  'vastagbor',
  'magyar-hang',
  'kmonitor-news',
]);

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');

const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

async function main() {
  // Összes forrás slug-jai az id alapján
  const sources = await db.select({ id: schema.sources.id, slug: schema.sources.slug }).from(schema.sources);
  const slugById = new Map(sources.map((s) => [s.id, s.slug]));

  // Összes cikk lekérése
  const articles = await db
    .select({
      id: schema.newsArticles.id,
      sourceId: schema.newsArticles.sourceId,
      headline: schema.newsArticles.headline,
      excerpt: schema.newsArticles.excerpt,
    })
    .from(schema.newsArticles);

  console.log(`Összesen: ${articles.length} cikk`);

  const toDelete: string[] = [];

  for (const a of articles) {
    const slug = slugById.get(a.sourceId) ?? '';
    if (RELEVANT_BY_DEFAULT_SLUGS.has(slug)) continue;
    if (!isRelevant(a.headline, a.excerpt ?? '')) {
      toDelete.push(a.id);
    }
  }

  console.log(`Törlésre kerül: ${toDelete.length} irreleváns cikk`);
  console.log(`Megmarad: ${articles.length - toDelete.length} releváns cikk`);

  if (toDelete.length === 0) {
    console.log('Nincs mit törölni.');
    await conn.end();
    return;
  }

  // Batch törlés (max 1000/kör, hogy ne legyen túl nagy a query)
  const BATCH = 1000;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    await db.delete(schema.newsArticles).where(inArray(schema.newsArticles.id, batch));
    deleted += batch.length;
    process.stdout.write(`\r${deleted}/${toDelete.length} törölve…`);
  }

  console.log(`\n✅ Kész.`);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
