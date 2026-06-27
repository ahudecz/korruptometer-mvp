import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ilike, or } from 'drizzle-orm';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

const URLS = [
  'https://hvg.hu/gazdasag/20260529_mnb-botrany-matolcsy-gyorgy-nyomozas-kutatas-ugyeszseg',
  'https://telex.hu/gazdasag/2026/06/11/matolcsy-gyorgy-170-millio-szabadsag-magyar-nemzeti-bank-vizsgalat',
  'https://www.portfolio.hu/gazdasag/20260422/megszolalt-matolcsy-az-mnb-botranyrol-szerinte-nem-az-tortent-amit-mindenki-gondol-832114',
  'https://www.forbes.hu/penz/matolcsy-gyorgy-mnb-jegybank-fizetes-szabadsag-vizsgalat/',
  'https://www.direkt36.hu/hatalmas-vagyonvesztest-es-mas-sulyos-problemakat-talalt-az-asz-matolcsyek-alapitvanyanal-a-kiszivargott-jelentestervezet-szerint/',
  'https://www.direkt36.hu/veres-volt-a-szaja-matolcsynak-orban-es-a-megtorpano-gazdasag-i/',
  'https://telex.hu/gazdasag/2025/11/03/kecskemeti-neumann-janos-egyetemert-alapitvany-szemereyne-pataki-klaudia-mnb-ugy-matolcsy-klan-jegyzokonyvek',
  'https://telex.hu/gazdasag/2025/10/27/mnb-ugy-kecskemeti-neumann-janos-egyetem-campus-mentetettek-okosvaros-innovacios-park-jovoje-szemereyne',
  'https://telex.hu/gazdasag/2025/10/20/mnb-szekhaz-felujitas-mnb-ingatlan-kft-feljelentes-raw-development',
  'https://telex.hu/gazdasag/2025/04/21/mnb-ugy-osszefoglalo-matolcsy-gyorgy-padme-allami-szamvevoszek',
];

const DOMAIN_TO_SLUG: Record<string, string> = {
  'telex.hu': 'telex',
  '444.hu': '444',
  'hvg.hu': 'hvg',
  '24.hu': '24hu',
  'atlatszo.hu': 'atlatszo',
  'direkt36.hu': 'direkt36',
};

function dedupHash(url: string) {
  return createHash('sha256').update(url).digest('hex');
}

function canonicalUrl(url: string) {
  try { const u = new URL(url); u.search = ''; u.hash = ''; return u.toString(); }
  catch { return url; }
}

function dateFromUrl(url: string): Date {
  // /2025/10/20/ or /20260529_ patterns
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

      const result = await db.insert(schema.newsArticles).values({
        sourceId,
        headline: headline.slice(0, 500),
        excerpt,
        sourceUrl: canonical,
        sourceUrlHash: dedupHash(canonical),
        publishedAt,
        tag: 'MNB',
        imageUrl,
        featured: true,
      }).onConflictDoUpdate({
        target: schema.newsArticles.sourceUrlHash,
        set: { tag: 'MNB', featured: true, publishedAt },
      }).returning({ id: schema.newsArticles.id });

      if (result.length > 0) inserted++;
      console.log(`✅ ${publishedAt.toISOString().slice(0, 10)} · ${headline.slice(0, 55)}`);
    } catch (e: any) {
      console.log(`❌ ${e.message}`);
      skipped++;
    }
  }

  // Meglévő MNB/Matolcsy cikkek taggelése
  const tagged = await db
    .update(schema.newsArticles)
    .set({ tag: 'MNB', featured: true })
    .where(or(
      ilike(schema.newsArticles.headline, '%matolcsy%'),
      ilike(schema.newsArticles.headline, '%mnb botrány%'),
      ilike(schema.newsArticles.headline, '%jegybank botrány%'),
      ilike(schema.newsArticles.excerpt, '%matolcsy%'),
    ))
    .returning({ id: schema.newsArticles.id });

  console.log(`\n✅ ${inserted} importálva, ${skipped} kihagyva, ${tagged.length} meglévő taggelve`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
