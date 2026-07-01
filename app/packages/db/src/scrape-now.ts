/**
 * Egyszeri scraper — lefuttatja az összes aktív forrást és beírja az új cikkeket az adatbázisba.
 * Használat: pnpm --filter @korr/db scrape-now
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import { adapters, isRelevant, shouldFeature } from '@korr/scrapers';
import type { OutletSlug } from '@korr/scrapers';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');

const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

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
  const sources = await db
    .select()
    .from(schema.sources)
    // only enabled sources (adapter presence is checked below)
    .where(eq(schema.sources.enabled, true));

  let totalInserted = 0;
  let totalFound = 0;

  for (const source of sources) {
    const adapter = adapters[source.slug as OutletSlug];
    if (!adapter) {
      console.log(`⏭  ${source.slug} — nincs adapter, kihagyva`);
      continue;
    }

    process.stdout.write(`📡 ${source.name} (${source.slug})… `);
    try {
      const articles = await adapter.crawl();
      totalFound += articles.length;
      let inserted = 0;

      const relevantByDefault = adapter.relevantByDefault ?? false;
      for (const a of articles) {
        if (!relevantByDefault && !isRelevant(a.headline, a.excerpt)) continue;
        const canonical = canonicalUrl(a.sourceUrl);
        const hash = dedupHash(canonical);
        const rows = await db
          .insert(schema.newsArticles)
          .values({
            sourceId: source.id,
            headline: a.headline.slice(0, 500),
            excerpt: a.excerpt,
            sourceUrl: canonical,
            sourceUrlHash: hash,
            publishedAt: a.publishedAt,
            tag: a.tag ?? null,
            imageUrl: a.imageUrl ?? null,
            featured: shouldFeature(a.headline, a.excerpt),
          })
          .onConflictDoNothing({ target: schema.newsArticles.sourceUrlHash })
          .returning({ id: schema.newsArticles.id });
        if (rows[0]) inserted++;
      }

      totalInserted += inserted;
      console.log(`${articles.length} cikk, ${inserted} új`);
    } catch (e: any) {
      console.log(`❌ hiba: ${e.message}`);
    }
  }

  console.log(`\n✅ Kész: ${totalFound} cikk találva, ${totalInserted} új beírva`);

  // Megmutatja a lemondás-kulcsszavas találatokat
  const KEYWORDS = ['lemond', 'kirúg', 'felment', 'leváltott', 'menesztés', 'távozik'];
  const recent = await db
    .select({ headline: schema.newsArticles.headline, sourceUrl: schema.newsArticles.sourceUrl })
    .from(schema.newsArticles)
    .orderBy(schema.newsArticles.publishedAt)
    .limit(500);

  const hits = recent.filter(a =>
    KEYWORDS.some(kw => a.headline.toLowerCase().includes(kw))
  );

  if (hits.length > 0) {
    console.log(`\n🔍 Lemondás-gyanús cikkek (${hits.length} db):`);
    for (const h of hits.slice(0, 20)) {
      console.log(`  • ${h.headline}`);
    }
  } else {
    console.log('\n🔍 Lemondás-kulcsszóra nem volt találat az aktuális cikkekben.');
  }

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
