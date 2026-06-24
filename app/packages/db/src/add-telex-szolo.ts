import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

async function main() {
  const url = 'https://telex.hu/belfold/2026/01/13/szolo-utca-gyanusitas-15-kiskoru-sertett';
  const urlHash = createHash('sha256').update(url).digest('hex');

  const existing = await db.select({ id: schema.newsArticles.id }).from(schema.newsArticles).where(eq(schema.newsArticles.sourceUrlHash, urlHash));
  if (existing.length > 0) { console.log('SKIP'); await conn.end(); return; }

  const src = await db.select({ id: schema.sources.id }).from(schema.sources).where(eq(schema.sources.slug, 'telex'));
  await db.insert(schema.newsArticles).values({
    headline: 'Legalább 15 kiskorú sértett van a Szőlő utcai ügyben',
    excerpt: 'A Telex feltárta: a kormány által tagadott kiskorú sértettek valójában legalább 15-en vannak — közvetlen ellentmondásban a Tuzson–Gulyás-féle nyilatkozatokkal.',
    sourceUrl: url,
    sourceUrlHash: urlHash,
    publishedAt: new Date('2026-01-13'),
    tag: 'zsolt-bacsi',
    featured: true,
    sourceId: src[0]?.id ?? null,
  });
  console.log('OK');
  await conn.end();
}
main().catch(console.error);
