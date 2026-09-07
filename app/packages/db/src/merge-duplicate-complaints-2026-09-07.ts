/**
 * Egyszeri, kézi takarítás a CriminalComplaint táblán — user által jelzett
 * duplikáció, 2026-09-07.
 *
 * 1) Waberer's / MFB-kötvényvásárlás: két 444.hu-cikk, 3 óra eltéréssel
 *    ugyanaznap, a rendszerbe pedig 3 MÁSODPERC eltéréssel került be
 *    (ugyanabban az órás detektor-futásban dolgozta fel mindkettőt).
 *    Kanonikus: caaed83b (az EREDETI feljelentés-cikk — "Gazdasági és
 *    Energetikai Minisztérium", 77 milliárd Ft, eventDate 11:23). Törölt:
 *    1a8a7d68 (a Waberer's-válasz cikk, ami csak háttérként ismétli meg a
 *    feljelentést — "Kapitány István gazdasági miniszter" mint filerName,
 *    összeg nélkül). findExistingComplaint() textMatchScore-ja kb. 0,25
 *    volt (a két targetName csak a "Waberer's" szón osztozik, minden más
 *    szó eltér: "állami kölcsön Tiborcz Istvánhoz kötött cégnek" vs "77
 *    milliárdos kötvényvásárlása") — a COMPLAINT_MATCH_LOW (0.34) alatt,
 *    tehát az AI-döntőbíró (isSameComplaintAi) meg SEM kapta a jelölt-párt.
 *
 * 2) MNB ingatlanügyek: hvg.hu (2026-09-03) és kontroll.hu (2026-09-04),
 *    1 nap eltéréssel. Kanonikus: aec1065e (a korábbi, hvg.hu-s sor).
 *    Törölt: c9e582d4 (kontroll.hu, a "MNB-Ingatlan Kft." céget nevesíti).
 *    Itt a textMatchScore kb. 0,5 volt — az AI-döntőbíró tényleg megkapta a
 *    jelölt-párt, de valószínűleg "nem ugyanaz" választ adott (a két rövid
 *    targetName-string, kontextus — filerName, dátum, leírás — nélkül
 *    a modell számára nem egyértelműen ugyanaz az ügy).
 *
 * Lásd a review.ts findExistingComplaint()/isSameComplaintAi() 2026-09-07-i
 * fixjét (külön commit) a gyökérok-javításért: a COMPLAINT_MATCH_LOW
 * küszöb csökkentve + isSameComplaintAi() több kontextust (filerName,
 * dátum) kap.
 *
 * Mindkét csoportnál a kanonikus sor marad meg, a törölt sor forrása
 * ráíródik (sourceUrls/Names/Headlines/Dates append), a törölt sor
 * törlődik. Nincs FK más táblából a CriminalComplaint.id-ra (l.
 * merge-duplicate-complaints-2026-08-13.ts azonos ellenőrzése), törlés
 * biztonságos.
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

const KEEP_WABERER_ID = 'caaed83b-2f88-43e1-adb5-c1b1098aec66';
const DELETE_WABERER = {
  id: '1a8a7d68-919e-4c3a-89c4-eb29823118d9',
  sourceUrl: 'https://444.hu/2026/09/07/a-waberers-visszautasitja-hogy-a-kotvenykibocsatasok-soran-jogellenes-elonyben-reszesult-volna',
  sourceName: '444.hu',
  sourceHeadline: "A Waberer's visszautasítja, hogy a kötvénykibocsátások során jogellenes előnyben részesült volna",
  sourceDate: '2026-09-07',
};

const KEEP_MNB_ID = 'aec1065e-2138-4122-b5d8-5b3781bf3cbb';
const DELETE_MNB = {
  id: 'c9e582d4-8470-4c9e-afe4-b7a25dbf0fae',
  sourceUrl: 'https://kontroll.hu/cikk/belfold/2026/09/04/feljelenti-sajat-ingatlanos-ceget-a-magyar-nemzeti-bank-toebb-ingatlanjuk-ertekvesztese-miatt',
  sourceName: 'Kontroll',
  sourceHeadline: 'Feljelenti saját ingatlanos cégét a Magyar Nemzeti Bank, több ingatlanjuk értékvesztése miatt',
  sourceDate: '2026-09-04',
};

async function mergeOne(
  sql: postgres.Sql,
  keepId: string,
  d: { id: string; sourceUrl: string; sourceName: string; sourceHeadline: string; sourceDate: string },
) {
  await sql`
    UPDATE "CriminalComplaint"
    SET "sourceUrls" = array_append("sourceUrls", ${d.sourceUrl}),
        "sourceNames" = array_append("sourceNames", ${d.sourceName}),
        "sourceHeadlines" = array_append("sourceHeadlines", ${d.sourceHeadline}),
        "sourceDates" = array_append("sourceDates", ${d.sourceDate}),
        "updatedAt" = now()
    WHERE id = ${keepId}
  `;
  const deleted = await sql`DELETE FROM "CriminalComplaint" WHERE id = ${d.id} RETURNING id, "targetName"`;
  console.log('Törölve (egyesítve):', deleted[0]?.id, deleted[0]?.targetName);
}

async function main() {
  assertWriteTarget('merge-duplicate-complaints-2026-09-07');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  await mergeOne(sql, KEEP_WABERER_ID, DELETE_WABERER);
  await mergeOne(sql, KEEP_MNB_ID, DELETE_MNB);

  const [waberer] = await sql`SELECT id, "targetName", "sourceUrls" FROM "CriminalComplaint" WHERE id = ${KEEP_WABERER_ID}`;
  console.log('Waberer\'s kanonikus sor:', waberer?.targetName, waberer?.sourceUrls);
  const [mnb] = await sql`SELECT id, "targetName", "sourceUrls" FROM "CriminalComplaint" WHERE id = ${KEEP_MNB_ID}`;
  console.log('MNB kanonikus sor:', mnb?.targetName, mnb?.sourceUrls);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
