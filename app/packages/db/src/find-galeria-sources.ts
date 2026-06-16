import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ilike, or, eq, desc } from 'drizzle-orm';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

async function findTop(label: string, conditions: ReturnType<typeof ilike>[]) {
  const rows = await db
    .select({
      headline: schema.newsArticles.headline,
      sourceUrl: schema.newsArticles.sourceUrl,
      publishedAt: schema.newsArticles.publishedAt,
      sourceName: schema.sources.name,
    })
    .from(schema.newsArticles)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.newsArticles.sourceId))
    .where(or(...conditions))
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(3);

  console.log(`\n=== ${label} ===`);
  if (rows.length === 0) {
    console.log('  (nincs találat)');
  } else {
    for (const r of rows) {
      const d = r.publishedAt.toISOString().slice(0, 10);
      console.log(`  [${r.sourceName}] ${d}`);
      console.log(`  ${r.headline}`);
      console.log(`  ${r.sourceUrl}`);
    }
  }
}

async function main() {
  // Orbán
  await findTop('Orbán — Aranykonvoj', [
    ilike(schema.newsArticles.headline, '%aranykonvoj%'),
    ilike(schema.newsArticles.headline, '%arany konvoj%'),
  ]);
  await findTop('Orbán — NER rendszer (Direkt36)', [
    ilike(schema.newsArticles.headline, '%ner%'),
    eq(schema.newsArticles.tag, 'orbán'),
  ]);

  // Rogán
  await findTop('Rogán — Letelepedési kötvény', [
    ilike(schema.newsArticles.headline, '%letelepedési kötvény%'),
    ilike(schema.newsArticles.headline, '%letelepedési kötven%'),
    ilike(schema.newsArticles.headline, '%rogán%'),
  ]);
  await findTop('Rogán — OFAC szankció', [
    ilike(schema.newsArticles.headline, '%ofac%'),
    ilike(schema.newsArticles.headline, '%szankció%rogán%'),
    ilike(schema.newsArticles.headline, '%rogán%szankció%'),
  ]);

  // Mészáros
  await findTop('Mészáros — Közbeszerzés', [
    ilike(schema.newsArticles.headline, '%mészáros%közbeszerzés%'),
    ilike(schema.newsArticles.headline, '%mészáros lőrinc%'),
  ]);
  await findTop('Mészáros — KESMA', [
    ilike(schema.newsArticles.headline, '%kesma%'),
    ilike(schema.newsArticles.headline, '%mészáros%média%'),
  ]);

  // Tiborcz
  await findTop('Tiborcz — Elios', [
    ilike(schema.newsArticles.headline, '%elios%'),
    ilike(schema.newsArticles.headline, '%tiborcz%olaf%'),
  ]);
  await findTop('Tiborcz — BDPST', [
    ilike(schema.newsArticles.headline, '%bdpst%'),
    ilike(schema.newsArticles.headline, '%tiborcz%ingatlan%'),
  ]);

  // Szíjjártó
  await findTop('Szíjjártó — Azerbajdzsán', [
    ilike(schema.newsArticles.headline, '%szíjjártó%azerbajdzsán%'),
    ilike(schema.newsArticles.headline, '%szijjarto%azerbajdzsán%'),
    ilike(schema.newsArticles.headline, '%szíjjártó%'),
  ]);

  // Takács
  await findTop('Takács — Lélegeztetőgép', [
    ilike(schema.newsArticles.headline, '%lélegeztetőgép%'),
    ilike(schema.newsArticles.headline, '%fourcardinal%'),
    ilike(schema.newsArticles.headline, '%takács péter%'),
  ]);

  // Matolcsy
  await findTop('Matolcsy — MNB alapítványok', [
    ilike(schema.newsArticles.headline, '%mnb%alapítvány%'),
    ilike(schema.newsArticles.tag, '%MNB%'),
  ]);
  await findTop('Matolcsy — ÁSZ vizsgálat', [
    ilike(schema.newsArticles.headline, '%ász%mnb%'),
    ilike(schema.newsArticles.headline, '%matolcsy%ász%'),
    ilike(schema.newsArticles.headline, '%számvevőszék%mnb%'),
  ]);
  await findTop('Matolcsy — Székházfelújítás', [
    ilike(schema.newsArticles.headline, '%mnb%felújítás%'),
    ilike(schema.newsArticles.headline, '%raw development%'),
    ilike(schema.newsArticles.headline, '%mnb%ingatlan%'),
  ]);
  await findTop('Matolcsy — Neumann egyetem', [
    ilike(schema.newsArticles.headline, '%neumann%mnb%'),
    ilike(schema.newsArticles.headline, '%kecskemét%mnb%'),
    ilike(schema.newsArticles.headline, '%matolcsy%kecskemét%'),
  ]);

  // Lázár
  await findTop('Lázár — Batida kastély', [
    ilike(schema.newsArticles.headline, '%batida%'),
    ilike(schema.newsArticles.headline, '%lázár%kastély%'),
    ilike(schema.newsArticles.headline, '%lázár%közút%'),
  ]);
  await findTop('Lázár — Vagyonosodás', [
    ilike(schema.newsArticles.headline, '%lázár%vagyon%'),
    ilike(schema.newsArticles.headline, '%lázár%ingatlan%'),
    ilike(schema.newsArticles.headline, '%lázár jános%vagyonnyilatkozat%'),
  ]);
  await findTop('Lázár — MÁV', [
    ilike(schema.newsArticles.headline, '%lázár%máv%'),
    ilike(schema.newsArticles.headline, '%máv%leállítás%'),
    ilike(schema.newsArticles.headline, '%balaton%vonat%kaosz%'),
  ]);

  // Balásy
  await findTop('Balásy — New Land Media', [
    ilike(schema.newsArticles.headline, '%balásy%'),
    ilike(schema.newsArticles.headline, '%new land media%'),
    ilike(schema.newsArticles.headline, '%állami reklám%'),
  ]);

  // Semjén
  await findTop('Semjén — Egyházi ingatlanok', [
    ilike(schema.newsArticles.headline, '%semjén%egyház%'),
    ilike(schema.newsArticles.headline, '%egyházi ingatlan%visszaadás%'),
  ]);
  await findTop('Semjén — Egyházi normatíva', [
    ilike(schema.newsArticles.headline, '%egyházi normatíva%'),
    ilike(schema.newsArticles.headline, '%semjén%oktatás%'),
    ilike(schema.newsArticles.headline, '%egyházi iskola%normatíva%'),
  ]);

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
