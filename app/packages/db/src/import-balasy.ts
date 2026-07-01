import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, ilike, sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

const URLS = [
  'https://hvg.hu/kkv/20260615_balasy-gyula-felajanlas-ceg-vallalkozas-allam-lounge-design-lounge-event-new-land-media-visual-europe-magantokealap-befektetes',
  'https://telex.hu/gazdasag/2026/06/14/balasy-gyula-ceg-magantokealap-allam-felajanlas-vagyonleltar',
  'https://444.hu/2026/06/14/101-ev-plakathiszteria-rogan-antal-es-balasy-gyula-magyarorszagan',
  'https://www.forbes.hu/uzlet/annyi-arbevetellel-zarta-balasy-gyula-cegcsoportja-2025-ot-mint-25-piaci-alapon-mukodo-ceg-osszesen/',
  'https://atlatszo.hu/kozpenz/2026/05/06/balasy-gyula-nem-mondott-igazat-a-siros-interjuban-a-kekplakatos-kampanyok-tervezeseben-is-kozremukodott/',
  'https://atlatszo.hu/kozpenz/2026/05/07/nkoh-beszamolo-37-milliard-forint-erteku-megbizas-log-a-levegoben-balasy-cegeinel/',
  'https://atlatszo.hu/kozpenz/2026/01/27/imazsrombolokra-hivatkozva-ujabb-milliardos-kommunikacios-szerzodest-kotott-a-szuverenitasvedelmi-hivatal-balasyekkal/',
  'https://telex.hu/gazdasag/2026/05/04/balasy-gyula-interju-kontroll-new-land-media-lounge-ner-reklamok',
];

const DOMAIN_TO_SLUG: Record<string, string> = {
  'hvg.hu': 'hvg',
  'telex.hu': 'telex',
  '444.hu': '444',
  'atlatszo.hu': 'atlatszo',
  'forbes.hu': 'forbes',
};

function metaContent(html: string, prop: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
  }
  return '';
}

function dedupHash(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

async function main() {
  // 1. Meglévő balásy cikkek kiemeléséhez UPDATE
  const updated = await db
    .update(schema.newsArticles)
    .set({ featured: true })
    .where(ilike(schema.newsArticles.headline, '%balásy%'))
    .returning({ id: schema.newsArticles.id });
  console.log(`✅ ${updated.length} meglévő Balásy cikk kiemelve`);

  // 2. Forrástábla betöltése
  const sources = await db.select().from(schema.sources);
  const slugToId = Object.fromEntries(sources.map((s) => [s.slug, s.id]));

  // 3. Cikkek beolvasása és beírása
  let inserted = 0;
  let skipped = 0;

  for (const url of URLS) {
    const canonical = canonicalUrl(url);
    const hash = dedupHash(canonical);
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const slug = DOMAIN_TO_SLUG[domain];
    const sourceId = slug ? slugToId[slug] : undefined;

    if (!sourceId) {
      console.log(`⏭  Nincs forrás a DB-ben: ${domain} — kihagyva`);
      skipped++;
      continue;
    }

    process.stdout.write(`📥 ${url.slice(0, 70)}… `);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
        signal: AbortSignal.timeout(8000),
      });
      const html = await res.text();

      const headline = metaContent(html, 'og:title') || metaContent(html, 'twitter:title');
      const excerpt = metaContent(html, 'og:description') || metaContent(html, 'twitter:description');
      const imageUrl = metaContent(html, 'og:image') || null;
      const publishedRaw = metaContent(html, 'article:published_time') || metaContent(html, 'og:article:published_time');
      const publishedAt = publishedRaw ? new Date(publishedRaw) : new Date();

      if (!headline) {
        console.log('⚠️  Nincs cím, kihagyva');
        skipped++;
        continue;
      }

      const rows = await db
        .insert(schema.newsArticles)
        .values({
          sourceId,
          headline: headline.slice(0, 500),
          excerpt,
          sourceUrl: canonical,
          sourceUrlHash: hash,
          publishedAt,
          tag: 'Balásy Gyula',
          imageUrl,
          featured: true,
        })
        .onConflictDoUpdate({
          target: schema.newsArticles.sourceUrlHash,
          set: { featured: true, tag: 'Balásy Gyula' },
        })
        .returning({ id: schema.newsArticles.id });

      if (rows[0]) {
        inserted++;
        console.log(`✅ ${headline.slice(0, 60)}`);
      } else {
        console.log('már benne van (featured=true beállítva)');
      }
    } catch (e: any) {
      console.log(`❌ ${e.message}`);
      skipped++;
    }
  }

  console.log(`\n🏁 ${inserted} beírva, ${skipped} kihagyva`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
