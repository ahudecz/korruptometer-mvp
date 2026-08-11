/**
 * Egyszeri, kézi javítás a PoliticalResignation táblán — user által jelzett
 * hiányzó felmentés, 2026-08-11.
 *
 * dr. Juhász Roland (a Gondosóra-programot üzemeltető Kormányzati
 * Szolgáltató Központ Nonprofit Kft. ügyvezetője) 2026-08-10-én azonnali
 * hatállyal felmentésre került. A resignation-detektor lefutott a cikken
 * (headline+excerpt), de az excerpt csak a pozíciót írta le nevesítve
 * nélkül ("felmentették a ... cég ügyvezetőjét"), a retry-teljes-cikk
 * mechanizmus is lefutott, de a nevet tartalmazó mondat egy <blockquote>
 * idézet-dobozban volt, amit az extractBodyText() heurisztika a "legnagyobb
 * <p>-blokk" versenyben elejtett — root cause fixelve
 * packages/scrapers/src/full-text-fetch.ts-ben. Ez a sor a hibás run
 * pótlása.
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
  assertWriteTarget('manual-resignation-2026-08-11');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const row = await sql`
    INSERT INTO "PoliticalResignation" (
      name, position, institution, "resignationType", "resignationDate",
      description, sector, "sourceUrls", "sourceNames", "reviewStatus"
    ) VALUES (
      'dr. Juhász Roland',
      'ügyvezető',
      'Kormányzati Szolgáltató Központ Nonprofit Kft. (Gondosóra-program)',
      'felmentés',
      '2026-08-10T00:00:00Z',
      'Felmentették a Kormányzati Szolgáltató Központból',
      'hatóságok, hivatalok, állami cégek',
      ARRAY['https://telex.hu/gazdasag/2026/08/10/tudomanyos-es-technologiai-miniszterium-feljelentes-gondosora-program-ugyvezeto-felmentes'],
      ARRAY['Telex'],
      'approved'
    )
    RETURNING id, name
  `;
  console.log('Beszúrva:', row[0]?.id, row[0]?.name);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
