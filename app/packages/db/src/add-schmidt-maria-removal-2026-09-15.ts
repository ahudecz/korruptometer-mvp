/**
 * Egyszeri, kézi felvétel a PoliticalResignation táblán — user által jelzett
 * távozás, 2026-09-15.
 *
 * Tarr Zoltán (Társadalmi Kapcsolatokért és Kultúráért Felelős Minisztérium)
 * saját döntése alapján azonnali hatállyal megszűnt Schmidt Mária
 * főigazgatói megbízatása a Terror Háza Múzeum élén; az intézmény a
 * kiállítás tartalmi átvilágításáig ideiglenesen bezár. A múzeumot addig
 * működtető Közép- és Kelet-európai Történelem és Társadalom Kutatásáért
 * Alapítvány augusztus 31-én megszűnt, feladatait a minisztérium alá tartozó
 * Kulturális Vagyonkezelő Kft. vette át.
 *
 * Schmidt Mária nincs a WATCH_LIST-en, ezért WatchlistRemoval-sor nem kell.
 * Idempotens: meglévő sor esetén nem szúr be újat.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';
import { assertWriteTarget } from './guard';

const PROD_URL = process.env.PROD_DATABASE_URL;
if (!PROD_URL) throw new Error('PROD_DATABASE_URL not set');
process.env.DATABASE_URL = PROD_URL;

async function main() {
  assertWriteTarget('add-schmidt-maria-removal-2026-09-15');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const existing = await sql`
    SELECT id FROM "PoliticalResignation"
    WHERE name = 'Schmidt Mária' AND institution ILIKE '%Terror Háza%'
  `;
  if (existing.length > 0) {
    console.log('Már létezik, nem szúrok be újat:', existing[0]!.id);
    await sql.end();
    return;
  }

  const row = await sql`
    INSERT INTO "PoliticalResignation" (
      name, position, institution, "resignationType", "resignationDate",
      description, sector, "sourceUrls", "sourceNames", "reviewStatus"
    ) VALUES (
      'Schmidt Mária',
      'főigazgató',
      'Terror Háza Múzeum',
      'felmentés',
      '2026-09-15T00:00:00Z',
      'Tarr Zoltán azonnali hatállyal megszüntette megbízatását',
      'kultúra',
      ARRAY['https://24.hu/kultura/2026/09/15/tarr-zoltan-schmidt-maria-terror-haza-megbizatas-megszunt/'],
      ARRAY['24.hu'],
      'approved'
    )
    RETURNING id, name, position, institution, "resignationType", "resignationDate", description, sector
  `;
  console.log('Beszúrva:', row[0]);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
