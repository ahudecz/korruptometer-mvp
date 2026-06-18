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

// Duplikát eltávolítva (telex 05/05 kétszer szerepelt)
const URLS = [
  'https://telex.hu/belfold/2026/05/05/hutlen-kezeles-es-koltsegvetesi-csalas-gyanujaval-feljelentest-tettek-az-nka-tamogatasok-ugyeben',
  'https://444.hu/2026/04/28/molnar-aron-azt-allitja-hanko-balazs-egyedul-dontott-kulturalis-tamogatasokrol-a-miniszter-szerint-minden-a-szabalyok-szerint-tortent',
  'https://444.hu/2026/05/07/az-nka-botrany-nem-egyszeri-kisiklas-hanem-a-rendszer-lenyege',
  'https://24.hu/kultura/2026/05/18/molnar-aron-nka-visszaeles/',
  'https://telex.hu/belfold/2026/06/03/tanukent-hallgatta-ki-molnar-aront-a-nav-az-nka-s-ugyben',
  'https://hvg.hu/itthon/20260615_tarr-zoltan-dontes-visszavonas-nka-hanko-balazs',
  'https://444.hu/2026/06/15/tarr-zoltan-kozel-400-millio-forintnyi-nka-tamogatast-von-vissza-amit-hanko-balazs-a-valasztas-elott-osztott-ki',
  'https://24.hu/belfold/2026/06/16/nka-tamogatas-gyor-nyomozas-nav/',
  'https://www.portfolio.hu/gazdasag/20260615/nka-botrany-volt-hogy-tobb-penzt-kapott-valaki-mint-amennyit-kert-843348',
  'https://www.portfolio.hu/gazdasag/20260616/dagad-az-nka-botrany-mar-gyorben-is-nyomoznak-843584',
  'https://www.forbes.hu/penz/nka-nav-hanko/',
];

const DOMAIN_TO_SLUG: Record<string, string> = {
  'telex.hu': 'telex',
  '444.hu': '444',
  'hvg.hu': 'hvg',
  '24.hu': '24hu',
  'atlatszo.hu': 'atlatszo',
};

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
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
  }
  return '';
}

async function main() {
  const sources = await db.select().from(schema.sources);
  const slugToId = Object.fromEntries(sources.map(s => [s.slug, s.id]));

  let inserted = 0, skipped = 0;

  for (const url of URLS) {
    const canonical = canonicalUrl(url);
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const slug = DOMAIN_TO_SLUG[domain];
    const sourceId = slug ? slugToId[slug] : undefined;

    if (!sourceId) {
      console.log(`⏭  ${domain} — nincs forrás a DB-ben, kihagyva`);
      skipped++;
      continue;
    }

    process.stdout.write(`📥 ${canonical.slice(0, 70)}… `);
    try {
      const res = await fetch(canonical, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'Accept-Language': 'hu-HU,hu;q=0.9' },
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();
      const headline = metaContent(html, 'og:title');
      const excerpt = metaContent(html, 'og:description');
      const imageUrl = metaContent(html, 'og:image') || null;
      const publishedRaw = metaContent(html, 'article:published_time');
      const publishedAt = publishedRaw
        ? new Date(publishedRaw)
        : dateFromUrl(canonical);

      if (!headline) { console.log('⚠️  nincs cím'); skipped++; continue; }

      await db.insert(schema.newsArticles).values({
        sourceId,
        headline: headline.slice(0, 500),
        excerpt,
        sourceUrl: canonical,
        sourceUrlHash: dedupHash(canonical),
        publishedAt,
        tag: 'NKA',
        imageUrl,
        featured: true,
      }).onConflictDoUpdate({
        target: schema.newsArticles.sourceUrlHash,
        set: { tag: 'NKA', featured: true },
      });

      inserted++;
      console.log(`✅ ${headline.slice(0, 60)}`);
    } catch (e: any) {
      console.log(`❌ ${e.message}`);
      skipped++;
    }
  }

  // Meglévő NKA/Hankó cikkek taggelése
  const { ilike, or } = await import('drizzle-orm');
  const tagged = await db
    .update(schema.newsArticles)
    .set({ tag: 'NKA', featured: true })
    .where(or(
      ilike(schema.newsArticles.headline, '%nka%'),
      ilike(schema.newsArticles.headline, '%hankó%'),
      ilike(schema.newsArticles.excerpt, '%nka%'),
    ))
    .returning({ id: schema.newsArticles.id });

  console.log(`\n✅ ${inserted} importálva, ${skipped} kihagyva, ${tagged.length} meglévő taggelve`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
