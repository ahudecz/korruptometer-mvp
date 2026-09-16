/**
 * Egyszeri javítás — user jóváhagyás, 2026-09-16.
 *
 * KÉT, egymástól FÜGGETLEN feljelentés van a Szijjártó Péter-féle
 * magánrepülőzésről. Szándékosan marad mindkettő: más a bejelentő, más a
 * dátum, és MÁS SZÁMOT állítanak — összemosni őket tényhiba lenne.
 *
 *   A) 2026-07-16, „Két magánszemély", 4,9 milliárd Ft
 *      = a gépbérlések TELJES összege (a Tisza-kormány bejelentése szerint,
 *        53 alkalom, 2022. jan. – 2026. ápr.)
 *      Hiba benne: a targetName „SZÍJJÁRTÓ"-t írt, hosszú í-vel. A brief 13.
 *      pontja szerint egy elgépelt név nem „apró hiba".
 *
 *   B) 2026-09-15, Orbán Anita külügyminiszter, legalább 4 milliárd Ft
 *      = a TÖBBLETKÖLTSÉG a menetrend szerinti business osztályhoz képest
 *        (átlagosan 5,6-szeres ár), a honvédségi gépek költsége NÉLKÜL.
 *      Két hibája volt:
 *        - `reviewStatus='pending'` — a user most jóváhagyta, mehet ki;
 *        - `filerName='Orbán Anitáék'` — a forrás (24.hu, 2026-09-15)
 *          egyértelmű: Orbán Anita külügyminiszter tett feljelentést a
 *          Külügyminisztériumban folyó átvilágítás eredményeként. A
 *          „…-ék" alak egy publikus adatbázisban pontatlan;
 *        - a `description` nyelvtanilag hibás volt („feljelentés a … gyanúja
 *          miatt … gyakorlata miatt" — kettős „miatt"), l.
 *          [[feedback-proofread-generated-text]].
 *
 * Az összeg-címke a B) sorra szándékosan „legalább 4 milliárd Ft
 * (többletköltség)": a puszta „4 milliárd Ft" azt sugallná, hogy ennyibe
 * kerültek a gépek, holott ennyivel kerültek TÖBBE.
 *
 * Idempotens: minden UPDATE feltétele a jelenlegi hibás érték.
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

const NEW_DESCRIPTION_B =
  'Orbán Anita külügyminiszter a Külügyminisztériumban folyó átvilágítás eredményeként '
  + 'különösen jelentős vagyoni hátrányt okozó hűtlen kezelés gyanújával tett feljelentést az '
  + 'előző vezetés magángépes utazási gyakorlata miatt. A vizsgálat szerint 2022-től rutinszerűvé '
  + 'vált, hogy a miniszter és delegációja bérelt magánrepülőgéppel vagy honvédségi különgéppel '
  + 'utazott, miközben a tárca belső szabályzata a takarékosságot írja elő. A 2022 és 2026 közötti '
  + 'gépbérlések konzervatív becslés szerint is legalább 4 milliárd forinttal, átlagosan '
  + '5,6-szeresen kerültek többe, mintha a delegációk menetrend szerinti járatokon, business '
  + 'osztályon utaztak volna; ebbe a honvédségi gépek költsége nincs beleszámolva.';

async function main() {
  assertWriteTarget('fix-szijjarto-complaints-2026-09-16');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  // A) névelírás javítása
  const a = await sql`
    UPDATE "CriminalComplaint"
    SET "targetName" = replace("targetName", 'Szíjjártó', 'Szijjártó'),
        "description" = replace("description", 'Szíjjártó', 'Szijjártó'),
        "updatedAt" = now()
    WHERE "targetName" LIKE '%Szíjjártó%' OR "description" LIKE '%Szíjjártó%'
    RETURNING id, "targetName"
  `;
  console.log(a.length ? `A) névelírás javítva: ${JSON.stringify(a)}` : 'A) nem volt mit javítani.');

  // B) jóváhagyás + bejelentő + leírás
  const b = await sql`
    UPDATE "CriminalComplaint"
    SET "reviewStatus" = 'approved',
        "filerName" = 'Orbán Anita külügyminiszter',
        "description" = ${NEW_DESCRIPTION_B},
        "amountLabel" = 'legalább 4 milliárd Ft (többletköltség)',
        "updatedAt" = now()
    WHERE "filerName" = 'Orbán Anitáék'
    RETURNING id, "targetName", "filerName", "reviewStatus", "amountLabel"
  `;
  console.log(b.length ? `B) jóváhagyva és javítva: ${JSON.stringify(b[0], null, 1)}` : 'B) nem volt mit javítani.');

  const all = await sql`
    SELECT id, "targetName", "filerName", "amountLabel", "status", "reviewStatus"
    FROM "CriminalComplaint"
    WHERE "targetName" ILIKE '%szijjártó%' OR "description" ILIKE '%szijjártó%'
    ORDER BY "eventDate" DESC
  `;
  console.log('\nSzijjártó-feljelentések a javítás után:');
  for (const r of all) console.log(` - [${r.reviewStatus}] ${r.filerName} → ${r.targetName} (${r.amountLabel ?? 'nincs összeg'})`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
