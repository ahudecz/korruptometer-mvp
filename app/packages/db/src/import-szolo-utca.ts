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

const SOURCE_SLUGS: Record<string, string> = {
  '444.hu': '444',
  'hvg.hu': 'hvg',
};

const ARTICLES = [
  {
    headline: 'A legfőbb ügyész elismerte, hogy van kiskorú sértett a Szőlő utcai ügynek',
    excerpt: 'Polt Péter legfőbb ügyész 2025 decemberében kénytelen volt elismerni, hogy igenis van kiskorú sértett a Szőlő utcai javítóintézeti ügyben — ez közvetlen ellentmondásban áll a korábbi Tuzson–Gulyás-féle tagadásokkal.',
    sourceUrl: 'https://444.hu/2025/12/17/a-legfobb-ugyesz-elismerte-hogy-van-kiskoru-sertett-a-szolo-utcai-ugynek',
    publishedAt: new Date('2025-12-17'),
    sourceDomain: '444.hu',
    tag: 'zsolt-bacsi',
    featured: true,
  },
  {
    headline: 'Tuzson Bence a Szőlő utcai javítóintézet ügyéről: kiskorú sértett nem volt és politikusok neve sem került elő',
    excerpt: 'Tuzson Bence 2025 szeptemberében egy 3 oldalas, a hivatalos megbízás előtt elkészített jelentés alapján jelentette ki: a Szőlő utcai ügynek nincs kiskorú sértettje. Az állítást a kormány több tagja is megismételte.',
    sourceUrl: 'https://hvg.hu/itthon/20250924_Tuzson-Bence-a-Szolo-utcai-javitointezet-ugyerol-kiskoru-sertett-nem-volt-es-politikusok-neve-sem-kerult-elo',
    publishedAt: new Date('2025-09-24'),
    sourceDomain: 'hvg.hu',
    tag: 'zsolt-bacsi',
    featured: true,
  },
  {
    headline: 'Szőlő utca: az igazgató elfogadhatatlannak nevezte, amit Tuzson a parlamentben mondott',
    excerpt: 'A Szőlő utcai javítóintézet igazgatója 2026 áprilisában a parlamentben elfogadhatatlannak nyilvánította Tuzson Bence korábbi kijelentéseit a kiskorú sértettekről.',
    sourceUrl: 'https://hvg.hu/itthon/20260429_szolo-utca-igazgato-kiskoru-sertett-elfogadhatatlan-tuzson-parlament',
    publishedAt: new Date('2026-04-29'),
    sourceDomain: 'hvg.hu',
    tag: 'zsolt-bacsi',
    featured: false,
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
