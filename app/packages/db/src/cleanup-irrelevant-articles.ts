import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, eq, not, or, ilike, inArray, sql } from 'drizzle-orm';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

// Ezek a cikkek MARADNAK (headline match vagy topic tag)
const KEEP_PATTERNS = [
  '%NKA%', '%MNB%', '%KESMA%', '%Mediaworks%', '%mediaworks%',
  '%lélegeztetőgép%', '%aranykonvoj%', '%hatvanpuszta%', '%batida%',
  '%Mészáros Lőrinc%', '%mészáros lőrinc%',
  '%Rogán%', '%rogán%',
  '%Matolcsy%', '%matolcsy%',
  '%Tiborcz%', '%tiborcz%',
  '%Balásy%', '%balásy%',
  '%Lázár János%', '%lázár jános%',
  '%Hankó%', '%hankó%',
  '%Szíjjártó%', '%szíjjártó%',
  '%volvo%gate%', '%Volvo%gate%',
  '%pesti srácok%', '%Pesti Srácok%',
  '%világgazdaság%', '%Világgazdaság%',
  '%Takács Péter%', '%takács péter%',
  '%Semjén%', '%semjén%',
  '%Bánki Erik%', '%bánki erik%',
  '%Orbán Viktor%', '%orbán viktor%',
  '%NER %', '%NER-%',
  '%Megafon%', '%megafon%',
  '%Windisch%', '%windisch%',
  '%Integritás Hatóság%', '%integritás hatóság%',
  '%Polt Péter%', '%polt péter%',
  '%Deák Dániel%', '%deák dániel%',
  '%XXI. Század%', '%xxi. század%',
] as const;

const KEEP_TAGS = ['NKA', 'MNB', 'Lemondás', 'volvo-gate', 'Megafon'];

async function main() {
  // 1. Összes cikk száma
  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.newsArticles);

  // 2. Meghatározzuk a törlendők feltételét:
  //    töröljük, ha NEM featured ÉS NEM topic-tag ÉS NEM headline-match
  const keepConditions = [
    eq(schema.newsArticles.featured, true),
    inArray(schema.newsArticles.tag, KEEP_TAGS),
    ...KEEP_PATTERNS.map(p => ilike(schema.newsArticles.headline, p)),
  ];

  const deleteWhere = not(or(...keepConditions)!);

  const [{ toDelete } = { toDelete: 0 }] = await db
    .select({ toDelete: sql<number>`count(*)::int` })
    .from(schema.newsArticles)
    .where(deleteWhere);

  console.log(`\nÖsszes cikk az adatbázisban: ${total}`);
  console.log(`Törlendő irreleváns cikk:     ${toDelete}`);
  console.log(`Maradó releváns cikk:          ${total - toDelete}\n`);

  // 3. Minta — 20 törlendő cikk
  const sample = await db
    .select({
      headline: schema.newsArticles.headline,
      tag: schema.newsArticles.tag,
    })
    .from(schema.newsArticles)
    .where(deleteWhere)
    .limit(20);

  console.log('Törlendők mintája (első 20):');
  for (const a of sample) {
    console.log(`  [${a.tag ?? 'no-tag'}] ${a.headline}`);
  }

  if (toDelete === 0) {
    console.log('\nNincs mit törölni.');
    await conn.end();
    return;
  }

  // 4. Törlés
  console.log(`\nTörlés folyamatban (${toDelete} sor)...`);
  const result = await db
    .delete(schema.newsArticles)
    .where(deleteWhere)
    .returning({ id: schema.newsArticles.id });

  console.log(`✅ Törölve: ${result.length} cikk`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
