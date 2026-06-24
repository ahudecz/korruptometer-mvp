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

const ARTICLES = [
  {
    headline: 'Videón, ahogy 27 milliárd forintnyi arany és bankjegyek elhagyják az országot',
    excerpt: 'A Fidesz választási veresége után visszaadták az ukrán Oschadbank lefoglalt vagyonát. Zelenszkij Facebook-posztban közölte elsőként a hírt. A szállítmány 35 millió eurót, 40 millió dollárt és 9 kg aranyat tartalmazott.',
    sourceUrl: 'https://444.hu/2026/05/06/videon-ahogy-27-milliard-forintnyi-arany-es-bankjegyek-elhagyjak-az-orszagot',
    publishedAt: new Date('2026-05-06'),
    tag: 'aranykonvoj',
    featured: true,
  },
  {
    headline: 'Visszavonták az aranykonvoj-ügyben érintett ukrán pénzszállítók kiutasítását',
    excerpt: 'Az Országos Idegenrendészeti Főigazgatóság visszavonta a hét ukrán pénzszállító kiutasítását és háromévnyi beutazási tilalmát. A szállítók csaknem 30 órát töltöttek bilincsben. A közigazgatási perek a Fővárosi Törvényszéken még folyamatban vannak.',
    sourceUrl: 'https://444.hu/2026/05/18/ugyvedjuk-szerint-visszavontak-az-aranykonvoj-ugyben-erintett-ukran-penzszallitok-kiutasitasat',
    publishedAt: new Date('2026-05-18'),
    tag: 'aranykonvoj',
    featured: false,
  },
  {
    headline: 'Az ukrán pénzszállítókra szabott törvényről szólt a választások előtti utolsó vita a parlamentben',
    excerpt: 'A parlament 119:25 arányban fogadta el a 2026. évi II. törvényt, amely 60 napot biztosított a NAV-nak titkos adatgyűjtésre. Több kormánytag — köztük Orbán Viktor — nem szavazott. Az ukrán külügyminiszter törvénytelenségnek nevezte az egész eljárást.',
    sourceUrl: 'https://444.hu/2026/03/10/az-ukran-penzszallitokra-szabott-torvenyrol-szolt-a-valasztasok-elotti-utolso-vita-a-parlamentben',
    publishedAt: new Date('2026-03-10'),
    tag: 'aranykonvoj',
    featured: false,
  },
];

async function main() {
  const src = await db.select({ id: schema.sources.id }).from(schema.sources).where(eq(schema.sources.slug, '444'));
  const sourceId = src[0]?.id ?? null;

  for (const art of ARTICLES) {
    const urlHash = hash(art.sourceUrl);
    const existing = await db.select({ id: schema.newsArticles.id }).from(schema.newsArticles).where(eq(schema.newsArticles.sourceUrlHash, urlHash));
    if (existing.length > 0) { console.log(`SKIP: ${art.headline}`); continue; }

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
