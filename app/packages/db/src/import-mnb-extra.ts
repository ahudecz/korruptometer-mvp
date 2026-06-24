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

function hash(url: string) {
  return createHash('sha256').update(url).digest('hex');
}

const SOURCE_SLUGS: Record<string, string> = {
  'telex.hu': 'telex',
  '444.hu': '444',
  'hvg.hu': 'hvg',
};

const ARTICLES = [
  {
    headline: 'A legfőbb ügyész az MNB-, a Szőlő utca-, a Schadl–Völner-ügyről is nyilatkozott',
    excerpt: 'A legfőbb ügyész egyszerre nyilatkozott a három legnagyobb folyamatban lévő ügyről — az MNB-alapítványok botrányáról, a Szőlő utcai üggyel kapcsolatos eljárásról és a Schadl–Völner-féle bírósági korrupcióról.',
    sourceUrl: 'https://www.szeretlekmagyarorszag.hu/hirek/legfobb-ugyesz-nagy-gabor-balint-mnb-szolo-utca-schadl-volner-ugy/',
    publishedAt: new Date('2026-06-01'),
    sourceDomain: 'szeretlekmagyarorszag.hu',
    tag: 'MNB',
    featured: false,
  },
  {
    headline: 'Magyar Péter megmutatta az MNB-székház hirhedt aranyvécéit',
    excerpt: 'Magyar Péter az MNB-székházban megmutatta azokat a luxus-vécéket, amelyek az MNB-alapítványok felelőtlen közpénzköltésének jelképévé váltak.',
    sourceUrl: 'https://telex.hu/belfold/2026/06/01/magyar-peter-megmutatta-az-mnb-szekhaz-hirhedt-aranyveceit',
    publishedAt: new Date('2026-06-01'),
    sourceDomain: 'telex.hu',
    tag: 'MNB',
    featured: false,
  },
];

async function main() {
  // Ensure szeretlekmagyarorszag.hu source exists
  await db.insert(schema.sources).values({
    slug: 'szeretlek-mo',
    name: 'Szeretlek Magyarország',
    homepage: 'https://www.szeretlekmagyarorszag.hu',
    tag: 'national' as const,
  }).onConflictDoNothing({ target: schema.sources.slug });

  for (const art of ARTICLES) {
    const urlHash = hash(art.sourceUrl);
    const existing = await db.select({ id: schema.newsArticles.id }).from(schema.newsArticles).where(eq(schema.newsArticles.sourceUrlHash, urlHash));
    if (existing.length > 0) { console.log(`SKIP: ${art.headline}`); continue; }

    let sourceId: number | null = null;
    const slug = SOURCE_SLUGS[art.sourceDomain];
    if (slug) {
      const rows = await db.select({ id: schema.sources.id }).from(schema.sources).where(eq(schema.sources.slug, slug));
      sourceId = rows[0]?.id ?? null;
    } else if (art.sourceDomain === 'szeretlekmagyarorszag.hu') {
      const rows = await db.select({ id: schema.sources.id }).from(schema.sources).where(eq(schema.sources.slug, 'szeretlek-mo'));
      sourceId = rows[0]?.id ?? null;
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
