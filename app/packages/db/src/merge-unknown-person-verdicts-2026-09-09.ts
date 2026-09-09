/**
 * Egyszeri, kézi takarítás a CourtVerdict táblán — user által jelzett
 * duplikáció, 2026-09-09.
 *
 * NKA-ügy / Fásy család: a NAV 2026-09-07 körül két embert vett őrizetbe
 * (egy 56 milliós dokumentumfilm-megbízás körüli csalás gyanújával). Az
 * eredeti hvg.hu/444.hu cikkekből az LLM-detektor "Ismeretlen két személy
 * (egyikük feltehetően Fásyné Gurzó Mária)" néven vette fel a sort
 * (26f6d0db). Egy nappal később egy hang.hu cikk megnevezte a férfit
 * (Munkácsy Art Kft. tulajdonos-ügyvezetője) — a detektor erre EGY ÚJ sort
 * hozott létre "Szabó Sándor" néven (4bcad828) ahelyett, hogy a meglévőt
 * frissítette volna, mert findExistingVerdict()/findFragmentNameMatch()
 * mindkettő personName-string egyezést keres, a két név viszont (értelemszerűen)
 * semmiben nem egyezett. Lásd review.ts findSimilarVerdictByContent() —
 * ugyanezen a napon épült gyökérok-javítás, hogy ez a jövőben pending-be
 * kerüljön automatikus duplikálás helyett.
 *
 * Kanonikus: 26f6d0db (a korábbi, két-személyes sor) — personName és summary
 * frissítve, hogy a férfit már névvel (Szabó Sándor) nevezze meg, a nő
 * továbbra is "feltehetően Fásyné Gurzó Mária" marad (a forráscikkek ezt sem
 * állítják tényként). Törölt: 4bcad828 (a Szabó Sándor-only sor), forrása
 * (hang.hu) ráíródik a kanonikus sorra.
 *
 * Idempotens: ha a törlendő sor már nem létezik (pl. mert ez a script már
 * lefutott, vagy — mint ezúttal — a takarítás előbb kézzel, közvetlen
 * Supabase REST hívással történt), nem csinál semmit.
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

const KEEP_ID = '26f6d0db-b2b4-48c8-b823-0663855197a3';
const DELETE = {
  id: '4bcad828-a846-404e-b7dd-9a262e637008',
  sourceUrl: 'https://hang.hu/belfold/a-fasy-csalad-cegeit-megbizo-vallalkozot-is-orizetbe-vettek-az-nka-ugyben-192034',
  sourceName: 'Magyar Hang',
  sourceHeadline: 'A Fásy család cégeit megbízó vállalkozót is őrizetbe vették az NKA-ügyben',
  sourceDate: '2026-09-09',
};

const MERGED_PERSON_NAME = 'Szabó Sándor és ismeretlen nő (feltehetően Fásyné Gurzó Mária)';
const MERGED_SUMMARY =
  'A NAV két embert vett őrizetbe az NKA-botrányban: Szabó Sándort, a Munkácsy Art Kft. tulajdonos-ügyvezetőjét, ' +
  'aki cégén keresztül közel 56 millió forintért bízott meg Fásy családhoz köthető cégeket egy dokumentumfilm ' +
  'elkészítésével, és egy nőt — feltehetően Fásyné Gurzó Mária, egy érintett cég tulajdonosa, de ezt a forráscikkek ' +
  'nem állítják tényként —, aki egy másik cég ügyvezetőjeként fiktív számlákkal leplezte, hogy a több mint 80 ' +
  'millió forintos NKA/NKTK-támogatásból a film nem készült el.';

async function main() {
  assertWriteTarget('merge-unknown-person-verdicts-2026-09-09');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const [stillThere] = await sql`SELECT id FROM "CourtVerdict" WHERE id = ${DELETE.id}`;
  if (!stillThere) {
    console.log('Már nincs meg a törlendő sor (' + DELETE.id + ') — a takarítás korábban (kézzel) megtörtént, nincs teendő.');
    const [row] = await sql`SELECT id, "personName", "sourceUrls" FROM "CourtVerdict" WHERE id = ${KEEP_ID}`;
    console.log('Kanonikus sor jelenlegi állapota:', row?.personName, row?.sourceUrls);
    await sql.end();
    return;
  }

  await sql`
    UPDATE "CourtVerdict"
    SET "personName" = ${MERGED_PERSON_NAME},
        "summary" = ${MERGED_SUMMARY},
        "sourceUrls" = array_append("sourceUrls", ${DELETE.sourceUrl}),
        "sourceNames" = array_append("sourceNames", ${DELETE.sourceName}),
        "sourceHeadlines" = array_append("sourceHeadlines", ${DELETE.sourceHeadline}),
        "sourceDates" = array_append("sourceDates", ${DELETE.sourceDate}),
        "updatedAt" = now()
    WHERE id = ${KEEP_ID}
  `;
  const deleted = await sql`DELETE FROM "CourtVerdict" WHERE id = ${DELETE.id} RETURNING id, "personName"`;
  console.log('Törölve (egyesítve):', deleted[0]?.id, deleted[0]?.personName);

  const [row] = await sql`SELECT id, "personName", "sourceUrls" FROM "CourtVerdict" WHERE id = ${KEEP_ID}`;
  console.log('Kanonikus sor:', row?.personName, row?.sourceUrls);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
