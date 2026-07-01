import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createHash } from 'node:crypto';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, ilike } from 'drizzle-orm';
import * as schema from './schema';

function dedupHash(url: string) {
  return createHash('sha256').update(url).digest('hex');
}

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

const ARTICLES = [
  {
    sourcePattern: '%444%',
    headline: 'Tarr Zoltán visszavon közel 400 millió forintnyi NKA-támogatást, amit Hankó Balázs a választás előtt osztott ki',
    excerpt: 'Visszavonja a Hankó Balázs által a választás előtt négy nappal kiosztott közel 394 millió forintos támogatásokat Tarr Zoltán kulturális miniszter.',
    sourceUrl: 'https://444.hu/2026/06/15/tarr-zoltan-kozel-400-millio-forintnyi-nka-tamogatast-von-vissza-amit-hanko-balazs-a-valasztas-elott-osztott-ki',
    publishedAt: new Date('2026-06-15T10:00:00Z'),
    tag: 'NKA',
    featured: true,
  },
  {
    sourcePattern: '%telex%',
    headline: 'Visszafizették a 17 milliárdos NKA pályázati pénzek tizedét, Kis Grófo is visszaadott 5 millió forintot',
    excerpt: '49 pályázó összesen 1,69 milliárd forintot fizetett vissza az NKA-nak. Az Index közérdekű adatigénylésből derült ki az összeg.',
    sourceUrl: 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt',
    publishedAt: new Date('2026-05-23T10:00:00Z'),
    tag: 'NKA',
    featured: true,
  },
];

async function main() {
  for (const art of ARTICLES) {
    const sources = await db
      .select({ id: schema.sources.id, name: schema.sources.name })
      .from(schema.sources)
      .where(ilike(schema.sources.name, art.sourcePattern));

    const source = sources[0];
    if (!source) {
      console.error(`Forrás nem található: ${art.sourcePattern}`);
      continue;
    }

    const sourceId = source.id;
    console.log(`Forrás: ${source.name} (id=${sourceId})`);

    const existing = await db
      .select({ id: schema.newsArticles.id })
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.sourceUrl, art.sourceUrl));

    if (existing.length > 0) {
      console.log(`Már létezik, frissítés: ${art.headline.slice(0, 60)}...`);
      await db
        .update(schema.newsArticles)
        .set({ tag: art.tag, featured: art.featured })
        .where(eq(schema.newsArticles.sourceUrl, art.sourceUrl));
      continue;
    }

    await db.insert(schema.newsArticles).values({
      sourceId,
      headline: art.headline,
      excerpt: art.excerpt,
      sourceUrl: art.sourceUrl,
      sourceUrlHash: dedupHash(art.sourceUrl),
      publishedAt: art.publishedAt,
      tag: art.tag,
      featured: art.featured,
    });

    console.log(`✅ Beírva: ${art.headline.slice(0, 60)}...`);
  }

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
