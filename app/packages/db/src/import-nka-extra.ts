import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, eq, ilike, isNotNull, not, or } from 'drizzle-orm';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

// NKA cikkek — lemondások + háttér + feljelentés
const URLS = [
  'https://telex.hu/belfold/2026/04/28/bus-balazs-nka-alelnok-lemondott-fidesz-celebek',
  'https://telex.hu/belfold/2026/04/30/baan-laszlo-nemzeti-kulturalis-alap-bizottsagi-tagsag-lemondas',
  'https://telex.hu/after/2026/04/30/nka-penzszoras-hanko-balazs-molnar-gabor-bajnai-zsolt-pataky-attila-fidesz-dopeman-deak-bill-gyula',
  'https://telex.hu/belfold/2026/04/30/fideszes-kepviselok-vurstlijara-mentek-el-tizmilliok-az-nka-eltitkolt-keretebol',
  'https://telex.hu/belfold/2026/04/30/nka-tamogatas-ibrany-bajnokok-ligaja-himnusz-nepzenei-feldolgozas',
  'https://telex.hu/after/2026/04/24/milliardokat-szort-ki-az-nka-titokban-a-fidesz-kampanyarcainak',
  'https://telex.hu/belfold/2026/05/02/vidnyanszky-attila-lemondott-a-nemzeti-kulturalis-alap-nka-bizottsagi-tagsagarol-hanko-balazs-tavozo-miniszter-milliardos-tamogatas-osztogatas-fidesz',
  'https://telex.hu/belfold/2026/05/05/hutlen-kezeles-es-koltsegvetesi-csalas-gyanujaval-feljelentest-tettek-az-nka-tamogatasok-ugyeben',
];

function dedupHash(url: string) {
  return createHash('sha256').update(url).digest('hex');
}

function canonicalUrl(url: string) {
  try { const u = new URL(url); u.search = ''; u.hash = ''; return u.toString(); }
  catch { return url; }
}

function dateFromUrl(url: string): Date {
  const slashDate = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (slashDate) return new Date(`${slashDate[1]}-${slashDate[2]}-${slashDate[3]}T12:00:00Z`);
  const compactDate = url.match(/\/(\d{4})(\d{2})(\d{2})_/);
  if (compactDate) return new Date(`${compactDate[1]}-${compactDate[2]}-${compactDate[3]}T12:00:00Z`);
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

// Szigorú NKA relevanciaszűrő — csak ezeket tartjuk meg NKA-taggel
function isNkaRelevant(headline: string, excerpt: string): boolean {
  const text = `${headline} ${excerpt}`.toLowerCase();
  return (
    text.includes('nka') ||
    text.includes('nemzeti kulturális alap') ||
    text.includes('kulturális alap') ||
    text.includes('hankó') ||
    text.includes('nka-')
  );
}

async function main() {
  const sources = await db.select().from(schema.sources);
  const telexSource = sources.find(s => s.slug === 'telex');
  if (!telexSource) {
    console.error('❌ Telex forrás nincs a DB-ben');
    await conn.end();
    process.exit(1);
  }

  let inserted = 0, updated = 0, skipped = 0;

  console.log('\n📥 7 NKA cikk importálása...\n');

  for (const url of URLS) {
    const canonical = canonicalUrl(url);
    process.stdout.write(`📥 ${canonical.slice(0, 72)}… `);
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

      if (!headline) { console.log('⚠️  nincs cím'); skipped++; continue; }

      await db.insert(schema.newsArticles).values({
        sourceId: telexSource.id,
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
        set: { tag: 'NKA', featured: true, publishedAt },
      });

      inserted++;
      console.log(`✅ ${publishedAt.toISOString().slice(0, 10)} · ${headline.slice(0, 55)}`);
    } catch (e: any) {
      console.log(`❌ ${e.message}`);
      skipped++;
    }
  }

  // ─── NKA cleanup: rossz cikkek kiszórása ───────────────────────────────────
  console.log('\n🧹 NKA cleanup — nem releváns cikkek kiszórása...\n');

  const nkaArticles = await db
    .select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      excerpt: schema.newsArticles.excerpt,
    })
    .from(schema.newsArticles)
    .where(eq(schema.newsArticles.tag, 'NKA'));

  const toRemove: string[] = [];
  for (const a of nkaArticles) {
    if (!isNkaRelevant(a.headline, a.excerpt ?? '')) {
      toRemove.push(a.id);
      console.log(`  🗑  "${a.headline.slice(0, 80)}"`);
    }
  }

  if (toRemove.length > 0) {
    // tag törlése — NKA-hoz nem köthetők
    for (const id of toRemove) {
      await db
        .update(schema.newsArticles)
        .set({ tag: null })
        .where(eq(schema.newsArticles.id, id));
    }
    console.log(`\n  → ${toRemove.length} cikk NKA-tagje törölve`);
  } else {
    console.log('  → Nincs eltávolítandó cikk');
  }

  console.log(`\n✅ ${inserted} importálva, ${skipped} kihagyva, ${toRemove.length} NKA-tag törölve`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
