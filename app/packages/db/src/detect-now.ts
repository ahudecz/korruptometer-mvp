/**
 * Egyszeri lemondás-detektor — végigmegy a DB-ben lévő cikkeken,
 * Claude Haiku-val megvizsgálja őket, és beírja a találatokat.
 * Használat: pnpm --filter @korr/db detect-now
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

// Local dev: bypass SSL certificate verification
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import * as schema from './schema';
import { isWatchlistPerson } from './watchlist';
import { detectResignationFromArticle } from './resignation-detect';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');

const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

const KEYWORDS = [
  'lemond', 'kirúg', 'felment', 'leváltott', 'leváltják', 'lemondott',
  'kirúgták', 'felmentették', 'távozik', 'távozott', 'mond le',
  'leváltás', 'menesztés', 'menesztette', 'menesztik',
  'elbocsát', 'elbocsátja', 'elbocsátják', 'elbocsátotta', 'elbocsátottak',
  'megszünteti', 'megszüntetik', 'bezárják', 'bezárja', 'leáll', 'megszűnik',
  'munkavállal', 'dolgozóit',
  // Indirekt pozícióváltás — utódot bejelentő cikkek is detektálhatók
  'átmeneti vezérigazgat', 'megbízott vezérigazgat',
  'átmeneti elnök', 'megbízott elnök', 'megbízott igazgat',
  'ideiglenes vezető', 'ideiglenes igazgat', 'ideiglenesen vezeti',
  'utódja', 'utóda lett', 'helyébe lépett', 'helyébe lép',
  'új vezérigazgat', 'új elnök', 'új igazgat',
];

// NER-közeli médiaemberek / intézményvezetők — róluk MINDEN cikket AI-ra küldünk,
// kulcsszó nélkül is, mert a pozícióváltásuk ritkán kerül explicit szóval a headline-be.
const ALWAYS_DETECT_NAMES = [
  'koltay andrás', 'koltay',
  'senyei györgy',
  'karancsi tibor',
  'nmhh', 'médiatanács',
  'mtva', 'duna médiaszolgáltató',
  'médiaszolgáltató nonprofit',
];

async function main() {
  const todayIso = new Date().toISOString().slice(0, 10);

  // Az összes cikket végignézzük (nem csak az utolsó 2 óra)
  const articles = await db
    .select({
      id: schema.newsArticles.id,
      headline: schema.newsArticles.headline,
      excerpt: schema.newsArticles.excerpt,
      publishedAt: schema.newsArticles.publishedAt,
      sourceUrl: schema.newsArticles.sourceUrl,
      sourceName: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(1000);

  const candidates = articles.filter((a) => {
    const text = `${a.headline} ${a.excerpt}`.toLowerCase();
    if (KEYWORDS.some((kw) => text.includes(kw))) return true;
    if (ALWAYS_DETECT_NAMES.some((n) => text.includes(n))) return true;
    return false;
  });

  console.log(`📚 Összesen: ${articles.length} cikk, ${candidates.length} lemondás-gyanús\n`);

  let inserted = 0;
  let skipped = 0;
  let filtered = 0;

  for (const article of candidates) {
    process.stdout.write(`🤖 „${article.headline.slice(0, 60)}…" → `);

    const { data: result } = await detectResignationFromArticle(
      article.headline,
      article.excerpt,
      todayIso,
    );

    if (!result || !result.isResignation || result.confidence < 0.7) {
      console.log(`nem politikai lemondás (confidence: ${result?.confidence ?? 0})`);
      filtered++;
      continue;
    }

    if (!result.name || !result.institution) {
      console.log(`hiányzó adat, kihagyva`);
      filtered++;
      continue;
    }

    // Dedup: ugyanaz a személy+intézmény 30 napon belül
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existing = await db
      .select({ id: schema.politicalResignations.id })
      .from(schema.politicalResignations)
      .where(
        and(
          sql`lower(${schema.politicalResignations.name}) = lower(${result.name})`,
          sql`lower(${schema.politicalResignations.institution}) = lower(${result.institution})`,
          gte(schema.politicalResignations.createdAt, thirtyDaysAgo),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`már létezik: ${result.name}`);
      skipped++;
      continue;
    }

    let resignationDate: Date;
    try {
      resignationDate = new Date(result.resignationDate);
      if (isNaN(resignationDate.getTime())) resignationDate = new Date(article.publishedAt);
    } catch {
      resignationDate = new Date(article.publishedAt);
    }

    const VALID_TYPES = ['lemondás', 'kirúgás', 'felmentés', 'egyéb'] as const;
    type ResignationType = typeof VALID_TYPES[number];
    const typeMap: Record<string, ResignationType> = {
      lemond: 'lemondás', lemondas: 'lemondás',
      kirúg: 'kirúgás', kirugas: 'kirúgás',
      felment: 'felmentés', felmentas: 'felmentés', felmentés: 'felmentés',
    };
    const rawType = result.resignationType as string;
    const resignationType: ResignationType =
      VALID_TYPES.includes(rawType as ResignationType)
        ? (rawType as ResignationType)
        : (typeMap[rawType.toLowerCase()] ?? 'egyéb');

    await db.insert(schema.politicalResignations).values({
      name: result.name.slice(0, 200),
      position: result.position.slice(0, 200),
      institution: result.institution.slice(0, 200),
      resignationType,
      resignationDate,
      description: result.description.slice(0, 1000) || null,
      sourceUrls: [article.sourceUrl],
      sourceNames: article.sourceName ? [article.sourceName] : [],
    });

    // Cikk megjelölése a /hirek Lemondás szűrőhöz, watchlist személyeknél breaking candidate
    const pinned = isWatchlistPerson(result.name);
    await db
      .update(schema.newsArticles)
      .set({ tag: 'Lemondás', isBreakingCandidate: pinned })
      .where(eq(schema.newsArticles.id, article.id));

    console.log(`✅ beírva: ${result.name} (${result.resignationType}, ${result.confidence.toFixed(2)})`);
    inserted++;
  }

  console.log(`\n✅ Kész: ${inserted} új lemondás beírva, ${skipped} duplikált, ${filtered} kiszűrve`);
  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
