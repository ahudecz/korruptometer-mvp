/**
 * Egyszeri törlés — 2026-09-16, a placeholder-guard leltár-tétel kapcsán
 * talált ÉLES sor.
 *
 * CriminalComplaint 85f00a63:
 *   targetName = 'Pilz Tamás — személyes adat visszaélés'  (név + bűncselekmény
 *                összemosva, nem tiszta célpont)
 *   filerName  = '<UNKNOWN>'                               (placeholder ment ki
 *                élesre — l. [[project-placeholder-guard-secondary-fields]])
 *   description: "A gyanú a Tisza-szimpatizánsok kirúgásával kapcsolatos
 *                feljelentésből ered."
 *
 * Az egyetlen forrást (24.hu, 2026-09-15) végigolvasva: a cikk SEHOL nem ír
 * feljelentésről és nem nevez meg feljelentőt. Amit ír: "Ezután indult
 * büntetőügy személyes és különleges adatok nyilvánosságra hozatala miatt."
 * A sor tehát nem egy hiányos feljelentés-rekord, hanem egy nem létező
 * feljelentés — nincs mit javítani rajta.
 *
 * Ugyanebből a cikkből született a CourtVerdict 7c275b15 is, amit ma
 * javítottunk ('előzetesben' → 'egyéb', l. fix-pilz-pretrial-2026-09-16.ts):
 * a cikk tartalma ott rendesen rögzítve van, tehát információ nem vész el.
 *
 * Törlés, nem reviewStatus='rejected': a rejected 30 napig duplikátum-csapdát
 * jelentene (l. [[project-auto-publish-revert]]).
 *
 * A ma megépített kapu (isPlaceholderName a filerName-en, l.
 * detect-criminal-complaints.ts) ezt a sort eleve blokkolta volna.
 *
 * Idempotens: újrafuttatva 0 sort érint.
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

const ROW_ID = '85f00a63-317e-4551-ad9c-489bbc7befdf';

async function main() {
  assertWriteTarget('delete-unknown-filer-complaint-2026-09-16');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const deleted = await sql`
    DELETE FROM "CriminalComplaint"
    WHERE id = ${ROW_ID} AND "filerName" = '<UNKNOWN>'
    RETURNING id, "targetName", "filerName"
  `;
  console.log(deleted.length ? `Törölve: ${JSON.stringify(deleted[0])}` : 'Nem volt mit törölni.');

  const left = await sql`
    SELECT count(*)::int AS n FROM "CriminalComplaint"
    WHERE lower(btrim("filerName")) IN ('<unknown>','unknown','ismeretlen','n/a','null','undefined','-','?','')
       OR lower(btrim("targetName")) IN ('<unknown>','unknown','ismeretlen','n/a','null','undefined','-','?','')
  `;
  console.log(`Maradék placeholder-es feljelentés-sor: ${left[0].n}`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
