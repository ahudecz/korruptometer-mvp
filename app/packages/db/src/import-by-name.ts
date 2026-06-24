/**
 * Kulcsszó alapú cikk-import: megkeresi az összes adott nevű cikket
 * a főbb magyar hírforrásokon (Telex, 444, HVG, Atlátszó, Magyar Hang)
 * és beírja a DB-be april 12 után.
 *
 * Használat: tsx src/import-by-name.ts "Mészáros Lőrinc"
 *            tsx src/import-by-name.ts "Szíjjártó Péter"
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { ilike, or } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

const CUTOFF = new Date('2026-04-12T00:00:00Z');
const NAME: string = process.argv[2] ?? '';
if (!NAME) {
  console.error('Adj meg egy nevet: tsx src/import-by-name.ts "Mészáros Lőrinc"');
  process.exit(1);
}

const TAG = NAME;
const query = encodeURIComponent(NAME);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'hu-HU,hu;q=0.9',
};

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

function extractUrls(html: string, baseHost: string, patterns: RegExp[]): string[] {
  const found = new Set<string>();
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const globalRe = new RegExp(re.source, 'gi');
    while ((m = globalRe.exec(html)) !== null) {
      try {
        const url = m[1]!.startsWith('http') ? m[1]! : `${baseHost}${m[1]!}`;
        found.add(url.replace(/&amp;/g, '&'));
      } catch { /* skip malformed URL */ }
    }
  }
  return [...found];
}

interface SearchTarget {
  slug: string;
  name: string;
  searchUrl: string;
  urlPatterns: RegExp[];
  baseHost: string;
}

const TARGETS: SearchTarget[] = [
  {
    slug: 'telex',
    name: 'Telex',
    searchUrl: `https://telex.hu/kereses?q=${query}&sort=date`,
    urlPatterns: [/href="(\/[a-z]+\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"/],
    baseHost: 'https://telex.hu',
  },
  {
    slug: '444',
    name: '444',
    searchUrl: `https://444.hu/?s=${query}`,
    urlPatterns: [/href="(https:\/\/444\.hu\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"/],
    baseHost: 'https://444.hu',
  },
  {
    slug: 'hvg',
    name: 'HVG',
    searchUrl: `https://hvg.hu/search?q=${query}&sort=date`,
    urlPatterns: [/href="(\/[a-z]+\/\d+_[^"]+)"/],
    baseHost: 'https://hvg.hu',
  },
  {
    slug: 'atlatszo',
    name: 'Atlátszó',
    searchUrl: `https://atlatszo.hu/?s=${query}`,
    urlPatterns: [/href="(https:\/\/atlatszo\.hu\/[^"]+\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"/],
    baseHost: 'https://atlatszo.hu',
  },
  {
    slug: 'magyar-hang',
    name: 'Magyar Hang',
    searchUrl: `https://hang.hu/?s=${query}`,
    urlPatterns: [/href="(https:\/\/hang\.hu\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"/],
    baseHost: 'https://hang.hu',
  },
];

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function importArticle(
  url: string,
  sourceId: string,
): Promise<'inserted' | 'updated' | 'skipped'> {
  const canonical = canonicalUrl(url);
  const hash = dedupHash(canonical);

  const html = await fetchPage(canonical);
  const headline = metaContent(html, 'og:title');
  const excerpt = metaContent(html, 'og:description');
  const imageUrl = metaContent(html, 'og:image') || null;
  const publishedRaw = metaContent(html, 'article:published_time');
  const publishedAt = publishedRaw ? new Date(publishedRaw) : new Date();

  if (!headline) return 'skipped';
  if (publishedAt < CUTOFF) return 'skipped';

  const nameNorm = NAME.toLowerCase().normalize('NFC');
  const textNorm = `${headline} ${excerpt}`.toLowerCase().normalize('NFC');
  if (!textNorm.includes(nameNorm) && !textNorm.includes(nameNorm.split(' ')[1]!)) {
    return 'skipped';
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
      tag: TAG,
      imageUrl,
      featured: true,
    })
    .onConflictDoUpdate({
      target: schema.newsArticles.sourceUrlHash,
      set: { tag: TAG, featured: true },
    })
    .returning({ id: schema.newsArticles.id });

  return rows[0] ? 'inserted' : 'updated';
}

async function main() {
  console.log(`\n🔍 Keresés: "${NAME}" — april 12 óta\n`);

  const sources = await db.select().from(schema.sources);
  const slugToId = Object.fromEntries(sources.map((s) => [s.slug, s.id]));

  let totalInserted = 0;

  for (const target of TARGETS) {
    const sourceId = slugToId[target.slug];
    if (!sourceId) {
      console.log(`⏭  ${target.name} — nincs a DB-ben`);
      continue;
    }

    process.stdout.write(`📡 ${target.name} keresése… `);
    let searchHtml: string;
    try {
      searchHtml = await fetchPage(target.searchUrl);
    } catch (e: any) {
      console.log(`❌ ${e.message}`);
      continue;
    }

    const urls = extractUrls(searchHtml, target.baseHost, target.urlPatterns);
    console.log(`${urls.length} találat`);

    let inserted = 0;
    for (const url of urls.slice(0, 30)) {
      try {
        const result = await importArticle(url, sourceId);
        if (result === 'inserted') inserted++;
        process.stdout.write(result === 'inserted' ? '✓' : result === 'updated' ? '↺' : '·');
      } catch {
        process.stdout.write('✗');
      }
    }
    console.log(`  → ${inserted} új`);
    totalInserted += inserted;
  }

  // Meglévő cikkek taggelése is
  const tagged = await db
    .update(schema.newsArticles)
    .set({ tag: TAG, featured: true })
    .where(
      or(
        ilike(schema.newsArticles.headline, `%${NAME.split(' ')[0]}%`),
        ilike(schema.newsArticles.excerpt, `%${NAME.split(' ')[0]}%`),
      ),
    )
    .returning({ id: schema.newsArticles.id });

  console.log(`\n✅ ${totalInserted} új cikk importálva, ${tagged.length} meglévő taggelve`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
