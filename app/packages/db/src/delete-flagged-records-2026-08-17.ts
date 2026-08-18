/**
 * Egyszeri, kézi takarítás — user által jelzett hibás/oda nem illő rekordok,
 * 2026-08-17.
 *
 * 1) PoliticalResignation "Altorjai Anita" — a detektor a ma (2026-08-17)
 *    megjelent telex cikkből ("Papp Dániel távozás 28 millió forint MTVA")
 *    ma-i dátummal, felmentés-típussal hozta létre a sort. A cikk viszont
 *    Altorjai Anitát MÁR "korábbi vezérigazgatóként" említi (a 2026. ápr.
 *    12. és aug. 2. között távozó munkatársak végkielégítéséről szóló
 *    cikkben) — nem állítja, hogy most mondott le/menesztették, és nem ad
 *    tényleges távozási dátumot. Rossz forrás alapján, rossz dátummal
 *    létrehozott hamis pozitív — törlés (nem reject-státusz, l. a
 *    project-auto-publish-revert memória: reject 30 napos duplikátum-
 *    csapdát nyitna egy esetleg később, jó forrással érkező helyes sorra).
 *
 * 2) CourtVerdict "P. Mária" (csengeri örökösnő) — még reviewStatus=pending,
 *    nem élt. A user szerint nem NER-korrupciós ügy (magánszemély csalási
 *    pere), csak Kósa Lajos érintettsége miatt szűrte be a detektor — "nem
 *    ide tartozik", törlés.
 *
 * 3) CriminalComplaint × 2 (ugyanaz a "csengeri örökösnő" ügy, már élő,
 *    approved) — ugyanaz az indoklás, mint a (2) pontnál.
 *
 * 4) CourtVerdict "Rogán Antal" (vakcinainfo.gov.hu adatkezelés) — a
 *    hivatkozott jogerős ítélet NEM Rogán Antal személyes büntetőjogi
 *    elítélése, hanem az Ítélőtábla döntése arról, hogy a KORMÁNY jogellenesen
 *    kezelt állampolgári adatokat egy propagandakampányban. A CourtVerdict
 *    séma (sentenceYears stb.) személyes büntetőítéletekre való, ide
 *    besorolva félrevezető ("X fő jogerősen elítélve" számláló hibásan nőtt
 *    vele) — user kérés: törlés innen, a mögöttes cikk úgyis automatikusan
 *    megjelenik Rogán Antal galéria-oldalának "Kapcsolódó hírek" hírfolyamában
 *    (newsKeywords: 'rogán' illeszkedik a "Rogánék" szóra a headline-ben).
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

const ALTORJAI_RESIGNATION_ID = 'cce5b9df-5059-462e-baae-5b75c73a4561';
const CSENGERI_VERDICT_ID = 'f14f47e2-18cb-46c3-9c68-89dd0b22181a';
const CSENGERI_COMPLAINT_IDS = [
  '6f1f93ee-d933-4fb0-abaa-650aed74a68e',
  '03e05721-0c11-4cbb-a35e-4ae8ee22faa0',
];
const ROGAN_VAKCINAINFO_VERDICT_ID = '3637f4c7-17d8-480f-b99b-672fbcc5c97d';

async function main() {
  assertWriteTarget('delete-flagged-records-2026-08-17');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const r1 = await sql`DELETE FROM "PoliticalResignation" WHERE id = ${ALTORJAI_RESIGNATION_ID} RETURNING id, name`;
  console.log('Törölve (Altorjai, rossz dátum/forrás):', r1[0]);

  const r2 = await sql`DELETE FROM "CourtVerdict" WHERE id = ${CSENGERI_VERDICT_ID} RETURNING id, "personName", "reviewStatus"`;
  console.log('Törölve (csengeri örökösnő ítélet, pending):', r2[0]);

  for (const id of CSENGERI_COMPLAINT_IDS) {
    const r = await sql`DELETE FROM "CriminalComplaint" WHERE id = ${id} RETURNING id, "targetName"`;
    console.log('Törölve (csengeri örökösnő feljelentés):', r[0]);
  }

  const r4 = await sql`DELETE FROM "CourtVerdict" WHERE id = ${ROGAN_VAKCINAINFO_VERDICT_ID} RETURNING id, "personName", summary`;
  console.log('Törölve (Rogán Antal — nem személyes ítélet):', r4[0]?.id, r4[0]?.personName);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
