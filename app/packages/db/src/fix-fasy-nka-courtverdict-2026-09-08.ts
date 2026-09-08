/**
 * Egyszeri, kézi javítás a CourtVerdict táblán — user jelzés, 2026-09-08.
 *
 * Két hiba egyben, ugyanarra a NAV-őrizetbevételre (NKA-botrány):
 *
 * 1) TÉVES SZEMÉLY-ATTRIBÚCIÓ (id 275dae91): a sor "Fásy Ádám" néven futott,
 *    de a forráscikk (444.hu) SEHOL nem állítja, hogy Fásy Ádámot vették
 *    őrizetbe — csak azt, hogy Szabó Sándornak (a megbízó cég tulajdonos-
 *    ügyvezetőjének) korábban közös cége volt Fásy Ádámmal. Az őrizetbe vett
 *    nőt a cikk NEM nevesíti; az egyetlen közvetett kapcsolat, hogy az egyik
 *    érintett cég (MVSZ 2015 Kft.) tulajdonosa Fásyné Gurzó Mária — ez csak
 *    FELTÉTELEZÉS/pletyka, a cikk ezt nem állítja tényként. Javítva:
 *    personName jelzi a bizonytalanságot ("feltehetően"), nem állítja
 *    tényként.
 *
 * 2) HALLUCINÁLT DÁTUM + DUPLIKÁTUM (id 26f6d0db): a sor verdictDate mezője
 *    2026-08-26-ra volt állítva, de a forráscikk (hvg.hu) 2026-09-07-i, és
 *    sehol nem szerepel augusztus 26. — valószínűleg az augusztus 26-i,
 *    MÁSIK NKA-sor (56d7a40d, "NKA-botrány ismeretlen gyanúsítottja",
 *    szabadlábra helyezésről) dátuma íródott át tévedésből erre az új
 *    eseményre. Emellett ez a sor ÉS a 275dae91 UGYANARRA a NAV-akcióra
 *    vonatkozik (444.hu és hvg.hu egy nappal eltérve ugyanazt a két
 *    őrizetbevételt írja le — l. mindkét cikk "az NKA-botrány újabb
 *    fejezete" / "Újabb két embert vettek őrizetbe az NKA-ügyben" kerete),
 *    tehát össze kell vonni.
 *
 * Kanonikus: 26f6d0db (helyes ügyészség-adattal). Törölt: 275dae91 (téves
 * "Fásy Ádám" néven futott sor), forrása ráíródik a kanonikus sorra.
 * Végleges adatok (mindkét cikk alapján, WebFetch-csel ellenőrizve
 * 2026-09-08-án):
 * - NAV vette őrizetbe mindkettőt (444.hu: "Őrizetbe vette a Nemzeti Adó- és
 *   Vámhivatal...").
 * - Egy férfi (a megbízó cég tulajdonos-ügyvezetője) ~56 millió Ft-ért
 *   bízta meg a Fásy-családhoz köthető cégeket a film elkészítésével.
 * - Egy nő (egy másik cég ügyvezetője, NEM nevesítve a cikkben) fiktív
 *   számlákkal leplezte, hogy a >80 millió Ft-os NKA/NKTK-támogatásból a
 *   film nem készült el — FELTEHETŐEN Fásyné Gurzó Mária, de ezt egyik
 *   forráscikk sem állítja tényként.
 * - Letartóztatásukról a cikk szerint szerdán dönt a bíróság.
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
  id: '275dae91-0c01-4a73-aba6-f6e7e24d09fe',
  sourceUrl: 'https://444.hu/2026/09/08/orizetbe-vettek-ket-embert-egy-fasy-csaladhoz-kotheto-dokumentumfilm-miatt',
  sourceName: '444',
  sourceHeadline: 'Őrizetbe vettek két embert egy, a Fásy családhoz köthető dokumentumfilm miatt',
  sourceDate: '2026-09-08',
};

const PERSON_NAME = 'Ismeretlen két személy (egyikük feltehetően Fásyné Gurzó Mária)';
const SUMMARY =
  'A NAV két embert vett őrizetbe az NKA-botrányban: egy férfit, aki cége tulajdonos-ügyvezetőjeként közel 56 millió forintért bízott meg Fásy családhoz köthető cégeket egy dokumentumfilm elkészítésével, és egy nőt — feltehetően Fásyné Gurzó Mária, egy érintett cég tulajdonosa, de ezt a forráscikkek nem állítják tényként —, aki egy másik cég ügyvezetőjeként fiktív számlákkal leplezte, hogy a több mint 80 millió forintos NKA/NKTK-támogatásból a film nem készült el. Letartóztatásukról a cikk szerint szerdán dönt a bíróság.';
const DESCRIPTION = 'NKA-ügy: két újabb őrizetbe vétel (Fásy-kötődés)';

async function main() {
  assertWriteTarget('fix-fasy-nka-courtverdict-2026-09-08');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  await sql`
    UPDATE "CourtVerdict"
    SET "personName" = ${PERSON_NAME},
        summary = ${SUMMARY},
        description = ${DESCRIPTION},
        "verdictDate" = '2026-09-07T00:00:00Z',
        "sourceUrls" = array_append("sourceUrls", ${DELETE.sourceUrl}),
        "sourceNames" = array_append("sourceNames", ${DELETE.sourceName}),
        "sourceHeadlines" = array_append("sourceHeadlines", ${DELETE.sourceHeadline}),
        "sourceDates" = array_append("sourceDates", ${DELETE.sourceDate}),
        "updatedAt" = now()
    WHERE id = ${KEEP_ID}
  `;
  const deleted = await sql`DELETE FROM "CourtVerdict" WHERE id = ${DELETE.id} RETURNING id, "personName"`;
  console.log('Törölve (egyesítve):', deleted[0]?.id, deleted[0]?.personName);

  const [kept] = await sql`SELECT id, "personName", "verdictDate", "sourceUrls" FROM "CourtVerdict" WHERE id = ${KEEP_ID}`;
  console.log('Kanonikus sor:', kept?.personName, kept?.verdictDate, kept?.sourceUrls);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
