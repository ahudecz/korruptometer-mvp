import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

const URLS = [
  'https://444.hu/2026/05/21/hont-andras-cege-tavaly-valahonnan-kapott-felmilliard-forintot',
  'https://444.hu/2026/05/27/hont-andras-azt-keri-ne-tole-kerdezzek-hogy-egy-fidesz-szimpatizans-milliardos-miert-ot-talalta-meg-felmilliard-forint-tamogatassal',
];

function dedupHash(url: string) {
  return createHash('sha256').update(url).digest('hex');
}

function canonicalUrl(url: string) {
  try { const u = new URL(url); u.search = ''; u.hash = ''; return u.toString(); }
  catch { return url; }
}

function dateFromUrl(url: string): Date {
  const m = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
  return new Date();
}

function metaContent(html: string, prop: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
  }
  return '';
}

async function main() {
  const sources = await db.select().from(schema.sources);
  const source444 = sources.find(s => s.slug === '444');
  if (!source444) {
    console.error('❌ 444 forrás nincs a DB-ben');
    await conn.end();
    process.exit(1);
  }

  console.log('\n📥 Hont András cikkek importálása (444.hu)...\n');
  let inserted = 0;

  for (const url of URLS) {
    const canonical = canonicalUrl(url);
    process.stdout.write(`📥 ${canonical.slice(0, 80)}… `);
    try {
      const res = await fetch(canonical, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
          'Accept-Language': 'hu-HU,hu;q=0.9',
        },
        signal: AbortSignal.timeout(12000),
      });
      const html = await res.text();
      const headline = metaContent(html, 'og:title');
      const excerpt = metaContent(html, 'og:description');
      const imageUrl = metaContent(html, 'og:image') || null;
      const publishedRaw = metaContent(html, 'article:published_time');
      const publishedAt = publishedRaw ? new Date(publishedRaw) : dateFromUrl(canonical);

      if (!headline) { console.log('⚠️  nincs cím'); continue; }

      await db.insert(schema.newsArticles).values({
        sourceId: source444.id,
        headline: headline.slice(0, 500),
        excerpt,
        sourceUrl: canonical,
        sourceUrlHash: dedupHash(canonical),
        publishedAt,
        tag: 'média',
        imageUrl,
        featured: true,
      }).onConflictDoUpdate({
        target: schema.newsArticles.sourceUrlHash,
        set: { tag: 'média', featured: true, publishedAt },
      });

      inserted++;
      console.log(`✅ ${publishedAt.toISOString().slice(0, 10)} · ${headline.slice(0, 60)}`);
    } catch (e: any) {
      console.log(`❌ ${e.message}`);
    }
  }

  console.log(`\n✅ ${inserted} cikk importálva`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
