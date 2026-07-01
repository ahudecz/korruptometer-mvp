import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createHash } from 'node:crypto';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, ilike, sql } from 'drizzle-orm';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

function dedupHash(url: string) {
  return createHash('sha256').update(url).digest('hex');
}

async function main() {
  // ── 1. Deák Dániel frissítése ─────────────────────────────────────
  const deak = await db
    .select({ id: schema.politicalResignations.id, name: schema.politicalResignations.name })
    .from(schema.politicalResignations)
    .where(ilike(schema.politicalResignations.name, '%Deák Dániel%'));

  if (deak.length > 0) {
    await db
      .update(schema.politicalResignations)
      .set({
        position: 'politikai elemző',
        institution: 'Megafon / XXI. Század Intézet',
        resignationType: 'lemondás',
        resignationDate: new Date('2026-06-07'),
        description: 'Saját kezdeményezésére lezárta együttműködését a Megafonnal és a XXI. Század Intézettel. Kormányfüggetlen politológusként folytatja — könyvön dolgozik az elmúlt évek tapasztalatairól.',
      })
      .where(ilike(schema.politicalResignations.name, '%Deák Dániel%'));
    console.log(`✅ Deák Dániel frissítve (${deak.length} sor)`);
  } else {
    console.log('⚠️  Deák Dániel nem található az adatbázisban, beírjuk...');
    await db.insert(schema.politicalResignations).values({
      name: 'Deák Dániel',
      position: 'politikai elemző',
      institution: 'Megafon / XXI. Század Intézet',
      resignationType: 'lemondás',
      resignationDate: new Date('2026-06-07'),
      description: 'Saját kezdeményezésére lezárta együttműködését a Megafonnal és a XXI. Század Intézettel. Kormányfüggetlen politológusként folytatja — könyvön dolgozik az elmúlt évek tapasztalatairól.',
      pinned: false,
    });
    console.log('✅ Deák Dániel beírva');
  }

  // ── 2. Megafon cikkek ────────────────────────────────────────────
  const [nepszava] = await db
    .select({ id: schema.sources.id })
    .from(schema.sources)
    .where(ilike(schema.sources.name, 'Népszava'));

  const [hu24] = await db
    .select({ id: schema.sources.id })
    .from(schema.sources)
    .where(ilike(schema.sources.name, '%24.hu%'));

  const articles = [
    {
      sourceId: nepszava?.id,
      sourceName: 'Népszava',
      headline: '„A Megafonban nem volt közpénz, Rogán Antalt én soha nem is láttam bent"',
      excerpt: 'Szűcs Gábor, a Fidesz új országgyűlési képviselője tagadja, hogy közpénz felhasználásáról lenne tudomása a Megafon működtetésében, és azt állítja, hogy Rogán Antal soha nem járt a szervezetnél.',
      sourceUrl: 'https://nepszava.hu/3323678_szucs-gabor-fidesz-megafon-kozpenz-interju-politika-magyarorszag',
      publishedAt: new Date('2026-05-27T08:12:00+02:00'),
    },
    {
      sourceId: hu24?.id,
      sourceName: '24.hu',
      headline: 'Valahonnan kapott 86 milliárdot a Megafon, így majd félmilliós nyereséget hoztak össze 2025-ben',
      excerpt: 'A Megafon 86 milliárd forintot kapott valahonnan, és ezzel közel félmilliós nyereséget értek el 2025-ben.',
      sourceUrl: 'https://24.hu/belfold/2026/05/31/valahonann-kapott-86-milliardot-a-megafon-igy-majd-felmillios-nyereseget-hoztak-ossze-2025-ben/',
      publishedAt: new Date('2026-05-31T00:00:00+02:00'),
    },
  ];

  for (const art of articles) {
    if (!art.sourceId) {
      console.error(`⚠️  Forrás nem található: ${art.sourceName}`);
      continue;
    }

    const existing = await db
      .select({ id: schema.newsArticles.id })
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.sourceUrlHash, dedupHash(art.sourceUrl)));

    if (existing.length > 0) {
      await db
        .update(schema.newsArticles)
        .set({ tag: 'Megafon', featured: true })
        .where(eq(schema.newsArticles.sourceUrlHash, dedupHash(art.sourceUrl)));
      console.log(`♻️  Frissítve: ${art.headline.slice(0, 60)}...`);
      continue;
    }

    await db.insert(schema.newsArticles).values({
      sourceId: art.sourceId,
      headline: art.headline,
      excerpt: art.excerpt,
      sourceUrl: art.sourceUrl,
      sourceUrlHash: dedupHash(art.sourceUrl),
      publishedAt: art.publishedAt,
      tag: 'Megafon',
      featured: true,
    });
    console.log(`✅ Beírva: ${art.headline.slice(0, 60)}...`);
  }

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
