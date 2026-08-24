/**
 * Egyszeri, kézi takarítás — user report, 2026-08-24.
 *
 * 1) PodcastVideo × 3 — az Átlátszó ugyanazt az almásfüzitői vörösiszap-
 *    tározó/lúgos szennyezés sztorit 3x töltötte fel pár nap alatt (2 db
 *    2026-08-21, 1 db 2026-08-23). A /podcastok és a nyitóoldal podcast-
 *    blokkja is TISZTÁN publishedAt DESC alapján választja a "hero"-t
 *    (page.tsx / podcastok/page.tsx) — semmilyen témabeli szűrés nincs,
 *    ezért a legutóbbi feltöltés (2026-08-23 18:00) automatikusan kiemelt
 *    lett, függetlenül attól, hogy releváns-e a téma. Törlés — nem kell a
 *    duplikált, tematikailag határeset tartalom, főleg nem kiemelten.
 *
 * 2) CriminalComplaint (új) — kormany.hu hivatalos közlemény: a
 *    Miniszterelnökség feljelentést tett a Kommentár Alapítvány közel 28
 *    milliárdos állami támogatásainak ügyében.
 *
 * 3) CriminalComplaint (Havasi Bertalan) — törlés. A feljelentés tárgya
 *    (saját elmaradt illetménye) nem korrupciós ügy, user szerint nem ide
 *    tartozik.
 *
 * 4) CriminalComplaint × 4 (Hajtó Péter, győri AI-dokumentum ügy) — mind a
 *    négy UGYANARRÓL a sztoriról szól (Pintér Bence győri polgármester
 *    feljelentése, 13 millió Ft, AI-gyanús dokumentum), csak a filerName
 *    megfogalmazása tért el cikkenként ("Pintér Bence" / "Győr
 *    polgármestere" / "Pintér Bence (Győr polgármestere)" / "Győr város
 *    (Pintér Bence polgármester)") — a filerName-egyeztetés (isSameComplainant,
 *    review.ts) ezt nem ismerte fel, ugyanaz a hibaosztály, mint a
 *    2026-08-13-i Kaminski/Paks takarítás. Egyesítve egy kanonikus sorba,
 *    mind a 4 forrás megtartva.
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

const LUGOS_VIDEO_IDS = [
  'f81f33d3-76af-4fe2-b7f3-0f4e60513a9f',
  'a7c4833b-9ad5-4849-b04e-4c68e0fa3cc1',
  '6bc819d1-654e-43f5-9f18-ba6bdf6d59c8',
];

const HAVASI_COMPLAINT_ID = '0493e018-29a8-489d-9d55-183e73001aaa';

const HAJTO_KEEP_ID = 'c5d125a2-75cd-4960-9f86-ec11dcaa3b0f';
const HAJTO_DROP = [
  { id: '82154b04-f501-4314-83b9-086fc3aa9081', url: 'https://444.hu/2026/08/21/feljelent-egy-ex-fideszes-kepviselot-a-gyori-polgarmester-egy-13-millios-tanulmany-miatt', name: '444', headline: '13 milliós tanulmány ügye — Hajtó Péter volt fideszes képviselő', date: '2026-08-21' },
  { id: 'e986f815-74b1-4f98-a247-0baf8f35b08e', url: 'https://telex.hu/belfold/2026/08/21/gyor-hajto-peter-pinter-bence-feljelentes-dokumentum-mesterseges-intelligencia', name: 'Telex', headline: 'Hajtó Péter - MI-vel generált dokumentum ügye', date: '2026-08-21' },
  { id: 'ee24a938-e25c-4c24-80cb-c3425730ba3e', url: 'https://kontroll.hu/cikk/belfold/2026/08/21/egy-ai-gyanus-dokumentumert-13-millio-forintot-kapott-az-egyik-gyori-oenkormanyzati-kepviselo', name: 'Kontroll', headline: 'Hajtó Péter önkormányzati képviselő által 13 millió forintért kapott AI-gyanús dokumentum ügye', date: '2026-08-21' },
];

async function main() {
  assertWriteTarget('fix-flagged-2026-08-24');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  // 1) lúgos szennyezés videók törlése
  const deletedVideos = await sql`DELETE FROM "PodcastVideo" WHERE id = ANY(${LUGOS_VIDEO_IDS}) RETURNING id, title`;
  console.log('Törölt PodcastVideo:', deletedVideos.map(v => v.title));

  // 2) Kommentár Alapítvány feljelentés — új sor
  const [inserted] = await sql`
    INSERT INTO "CriminalComplaint" (
      id, "targetName", "filerName", description, status, "eventDate", "filedAt",
      "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates",
      "reviewStatus", "amountLabel", "relatedCaseIds", "relatedCaseLabels"
    ) VALUES (
      gen_random_uuid(),
      'Kommentár Alapítvány állami támogatásai',
      'Miniszterelnökség',
      'A Miniszterelnökség feljelentést tett a Készenléti Rendőrség Nemzeti Nyomozó Irodáján ismeretlen tettes ellen hűtlen kezelés, hivatali visszaélés, költségvetési csalás és versenykorlátozó közbeszerzési megállapodás gyanúja miatt a Kommentár Alapítvány 2020–2026 között kapott, csaknem 28 milliárd forintos állami támogatásai ügyében. Az éves működési támogatás e idő alatt a huszonnyolcszorosára nőtt pályázati verseny nélkül, közbeszerzési kockázatok és hiányos ingatlan-értékbecslések mellett.',
      'feljelentés',
      '2026-08-24',
      '2026-08-24',
      ARRAY['https://kormany.hu/kormanyzat/miniszterelnokseg/hirek/feljelentes-miniszterelnokseg-kommentar-alapitvany-tamogatasainak-ugyeben'],
      ARRAY['Miniszterelnökség (kormany.hu)'],
      ARRAY['Feljelentést tett a Miniszterelnökség a Kommentár Alapítvány csaknem 28 milliárdos állami támogatásainak ügyében'],
      ARRAY['2026-08-24'],
      'approved',
      '27,8 milliárd Ft',
      ARRAY[]::text[],
      ARRAY[]::text[]
    )
    RETURNING id, "targetName"
  `;
  console.log('Beszúrva:', inserted);

  // 3) Havasi Bertalan feljelentés törlése
  const deletedHavasi = await sql`DELETE FROM "CriminalComplaint" WHERE id = ${HAVASI_COMPLAINT_ID} RETURNING id, "targetName"`;
  console.log('Törölve (Havasi):', deletedHavasi[0]);

  // 4) Hajtó Péter — 3 duplikátum egyesítése a kanonikus sorba
  for (const d of HAJTO_DROP) {
    await sql`
      UPDATE "CriminalComplaint"
      SET "sourceUrls" = array_append("sourceUrls", ${d.url}),
          "sourceNames" = array_append("sourceNames", ${d.name}),
          "sourceHeadlines" = array_append("sourceHeadlines", ${d.headline}),
          "sourceDates" = array_append("sourceDates", ${d.date}),
          "updatedAt" = now()
      WHERE id = ${HAJTO_KEEP_ID}
    `;
    const del = await sql`DELETE FROM "CriminalComplaint" WHERE id = ${d.id} RETURNING id`;
    console.log('Törölve (Hajtó duplikátum, egyesítve):', del[0]?.id);
  }
  const [hajtoFinal] = await sql`SELECT id, "targetName", "sourceUrls" FROM "CriminalComplaint" WHERE id = ${HAJTO_KEEP_ID}`;
  console.log('Hajtó kanonikus sor:', hajtoFinal);

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
