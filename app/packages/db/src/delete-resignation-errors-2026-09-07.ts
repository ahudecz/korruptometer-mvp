/**
 * Egyszeri, kézi takarítás a PoliticalResignation táblán — user által
 * jelzett hibák, 2026-09-07.
 *
 * 1) Császár Attila (465ac368) — a hvg.hu 2026-09-07-i cikke ("Császár
 *    Attila, a köztévé kirúgott riportere a KDNP-nél kapott munkát")
 *    valójában egy ÚJ ÁLLÁS-hír, ami háttérként MÚLT IDŐBEN, mellékesen
 *    említi a már ismert (2026-07-07-i, MTVA/M1) kirúgását. A detektor ezt
 *    tévesen ÚJ kirúgás-eseményként extrahálta. A pontos (intézmény-
 *    egyeztetett) isDuplicate() nem ismerte fel duplikátumnak, mert az
 *    intézmény-mező eltérő szöveggel szerepelt ("MTVA" vs "köztévé (MTV)"
 *    — valójában ugyanaz a közmédia). Törlés — nem is egy második,
 *    valós esemény, csak félreolvasott extrakció.
 *
 * 2) Páger Pál Attila (d3358ffd) — a 444.hu 2026-09-07-i cikke szerint
 *    ("Lannert Judit kirúgta a csepeli iskola igazgatóját, amiért felvette
 *    a gyermekbántalmazási ügyekben érintett volt fóti gyermekotthon
 *    vezetőjét") NEM Páger lett kirúgva — ő az a személy, akit a csepeli
 *    Farkas Bertalan Általános Iskola igazgatója felvett gyógypedagógusként
 *    annak ellenére, hogy vizsgálat van ellene. A ténylegesen kirúgott
 *    személy a csepeli iskola IGAZGATÓJA (nem Páger), akinek a nevét ez a
 *    cikk nem is nevezi meg konkrétan a lekért kivonatban. Rossz
 *    személyhez rendelt esemény — téves extrakció, törlés.
 *
 * Mindkét sor reviewStatus='approved' (már élt/élt volna a nyilvános
 * oldalon). Lásd a review.ts findFragmentNameMatch() 2026-09-07-i
 * bevezetését (külön commit) a jövőbeli hasonló esetek elleni védelemért —
 * mostantól egy töredékesen egyező név sose megy ki automatikusan, mindig
 * Telegram-jóváhagyást kér.
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

const CSASZAR_RECAP_ID = '465ac368-dfe6-4c08-ae3a-808e7b513970';
const PAGER_MISATTRIBUTION_ID = 'd3358ffd-b1a8-4aad-a09e-04f9a6040664';

async function main() {
  assertWriteTarget('delete-resignation-errors-2026-09-07');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const r1 = await sql`DELETE FROM "PoliticalResignation" WHERE id = ${CSASZAR_RECAP_ID} RETURNING id, name, institution`;
  console.log('Törölve (Császár Attila, félreolvasott recap-cikk):', r1[0]);

  const r2 = await sql`DELETE FROM "PoliticalResignation" WHERE id = ${PAGER_MISATTRIBUTION_ID} RETURNING id, name, institution`;
  console.log('Törölve (Páger Pál Attila, rossz személyhez rendelt esemény):', r2[0]);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
