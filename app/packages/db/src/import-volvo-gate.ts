import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, or, ilike } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

function hash(url: string) {
  return createHash('sha256').update(url).digest('hex');
}

const SOURCES_TO_ENSURE = [
  { slug: 'hadhazy', name: 'Hadházy Ákos', homepage: 'https://hadhazyakos.hu', tag: 'newsletter' as const },
  { slug: 'elszamoltatas-pecs', name: 'Elszámoltatás Pécs', homepage: 'https://elszamoltatas.pecs.hu', tag: 'regional' as const },
];

const SOURCE_SLUGS: Record<string, string> = {
  'hadhazyakos.hu': 'hadhazy',
  'telex.hu': 'telex',
  '444.hu': '444',
  'elszamoltatas.pecs.hu': 'elszamoltatas-pecs',
};

const ARTICLES = [
  {
    headline: 'A pécsi Volvo-gate valójában Bánki Erik eltussolt korrupciós ügye',
    excerpt: 'Az egyik legjobban bizonyított és legszemtelenebb lopás volt, amiben nyakig ült a Fidesz regionális igazgatója, Bánki Erik — az ügyészség mégis felmentette.',
    sourceUrl: 'https://hadhazyakos.hu/2023/07/08/a-pecsi-volvo-gate-valojaban-banki-erik-eltussolt-korrupcios-ugye/',
    publishedAt: new Date('2023-07-08'),
    sourceDomain: 'hadhazyakos.hu',
    tag: 'volvo-gate',
    featured: true,
  },
  {
    headline: 'Bánki Erik fideszes képviselőt ismét meghallgatták a pécsi Volvo-botrány tárgyalásán',
    excerpt: 'A Szekszárdi Törvényszék harmadszor hallgatta meg Bánki Eriket tanúként a pécsi buszbeszerzési korrupciós ügyben. Bánki tagadja az érintettséget.',
    sourceUrl: 'https://telex.hu/belfold/2025/05/05/banki-erik-fideszes-kepviselo-pecsi-volvo-botrany-targyalas-tanumeghallgatas-szekszardi-torvenyszek',
    publishedAt: new Date('2025-05-05'),
    sourceDomain: 'telex.hu',
    tag: 'volvo-gate',
    featured: true,
  },
  {
    headline: 'Hadházy feljelentése után újabb nyomozás indul a pécsi Volvo-gate ügyben',
    excerpt: 'A Fejér Megyei Rendőrség új nyomozást indít a vádemeléssel eddig nem érintett személyek tevékenységével kapcsolatban, köztük a Bánki-közeli cégeknek kifizetett 52 millió forint és a thaiföldre utalt 550 000 EUR ügyében.',
    sourceUrl: 'https://444.hu/2026/06/16/hadhazy-feljelentese-utan-ujabb-nyomozas-indul-a-pecsi-volvo-gate-ugyben',
    publishedAt: new Date('2026-06-16'),
    sourceDomain: '444.hu',
    tag: 'volvo-gate',
    featured: true,
  },
  {
    headline: 'Breking: kihallgatja a bíróság a Volvo-gate ügyben Bánki Eriket',
    excerpt: 'A Szekszárdi Törvényszék tanúként idézte be Bánki Eriket. A harmadrendű vádlott már bűnösnek vallotta magát pénzmosásban; 170 millió forint értékű eurót juttatott el offshore csatornákon keresztül.',
    sourceUrl: 'https://elszamoltatas.pecs.hu/jegyzetek/breking-kihallgatja-a-birosag-a-volvo-gate-ugyben-banki-eriket.html',
    publishedAt: new Date('2025-04-15'),
    sourceDomain: 'elszamoltatas.pecs.hu',
    tag: 'volvo-gate',
    featured: false,
  },
];

async function main() {
  // Ensure all required sources exist
  for (const src of SOURCES_TO_ENSURE) {
    await db.insert(schema.sources).values(src).onConflictDoNothing({ target: schema.sources.slug });
  }

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

    const slug = SOURCE_SLUGS[art.sourceDomain];
    let sourceId: number | null = null;

    if (slug) {
      const rows = await db
        .select({ id: schema.sources.id })
        .from(schema.sources)
        .where(eq(schema.sources.slug, slug));
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
