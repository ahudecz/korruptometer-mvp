import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

function hash(url: string) {
  return createHash('sha256').update(url).digest('hex');
}

const ARTICLES = [
  {
    headline: 'Zsigmond Ágost diszpáncélja: a Nemzeti Múzeum műtárgyait elajándékozta a NER Lengyelországnak',
    excerpt: 'A magyar Nemzeti Múzeum egyik legféltettebb középkori darabját, Zsigmond Ágost lengyel király diszpáncélját elajándékozták Lengyelországnak — az átadás mögött a NER-diplomácia és az Orbán-kormány politikai érdekei állnak.',
    sourceUrl: 'https://www.valaszonline.hu/2026/05/15/zsigmond-agost-diszpancelja-elajandekozas-nemzeti-muzeum-mutargyak-ner-lengyelorszag/',
    publishedAt: new Date('2026-05-15'),
    sourceDomain: 'valasz',
    tag: 'orbán',
    featured: true,
  },
];

async function main() {
  for (const art of ARTICLES) {
    const urlHash = hash(art.sourceUrl);

    const existing = await db
      .select({ id: schema.newsArticles.id })
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.sourceUrlHash, urlHash));

    if (existing.length > 0) {
      console.log(`SKIP: ${art.headline}`);
      continue;
    }

    const rows = await db
      .select({ id: schema.sources.id })
      .from(schema.sources)
      .where(eq(schema.sources.slug, art.sourceDomain));
    const sourceId = rows[0]?.id ?? null;

    if (!sourceId) {
      console.error(`❌ Forrás nem található: ${art.sourceDomain}`);
      continue;
    }

    await db.insert(schema.newsArticles).values({
      headline: art.headline,
      excerpt: art.excerpt,
      sourceUrl: art.sourceUrl,
      sourceUrlHash: urlHash,
      publishedAt: art.publishedAt,
      tag: art.tag,
      featured: art.featured,
      sourceId,
    });

    console.log(`OK: ${art.headline}`);
  }

  await conn.end();
}

main().catch(console.error);
