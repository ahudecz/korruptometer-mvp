/**
 * Egyszeri, kézi takarítás a CriminalComplaint táblán — user által jelzett
 * duplikáció, 2026-09-08.
 *
 * Szuverenitásvédelmi Hivatal / Balásy Gyula-konzorcium feljelentés: két sor
 * jött létre UGYANARRA az eseményre (Miniszterelnökség feljelentése a
 * Hivatal ~3,5-3,67 Mrd Ft-os kommunikációs/rendezvényszervezési kiadásai
 * miatt, hűtlen kezelés gyanújával).
 *
 * Gyökérok: a két beszúrás KÉT FÜGGETLEN pipeline-on ment át, amik nem
 * osztoznak dedup-logikán:
 * 1) sync-kormanyhu-complaints.ts (napi kormany.hu-egyeztetés, 861c3b50,
 *    12:01) — ez a job a saját, egyszerű matchStrength()-jét használja
 *    findExistingComplaint()/findFragmentNameMatch() HELYETT, és minden új
 *    sort feltétel nélkül 'approved'-ra tesz (l. a fájl fejlécének 2. ága —
 *    "megbízható forrás, nem kell emberi jóváhagyás"). A 2026-09-07-i
 *    "feljelentés mindig Telegram-jóváhagyásra megy" fix ERRE a jobra nem
 *    lett alkalmazva, csak a detect-criminal-complaints.ts LLM-detektorra.
 * 2) detect-criminal-complaints.ts (a 24.hu-cikket feldolgozó LLM-detektor,
 *    e8a65407, 14:30) — ez MÁR a fix utáni kódon futott (reviewStatus
 *    kényszerítve 'pending'), DE az LLM ezúttal üres targetEntity-t adott
 *    vissza egy intézményi célpontra ("Szuverenitásvédelmi Hivatal" —
 *    hasonló gap, mint a 2026-07-13-i K-Monitor-audit generikus intézmény-
 *    egyezési hiánya), így findFragmentNameMatch() nem tudott lefutni (l.
 *    detect-criminal-complaints.ts kommentje: "csak akkor fut, ha van
 *    targetEntity"), a Telegram-üzenet nem mutatott konfliktust, és a
 *    jóváhagyó ember nem látta, hogy már van egy kormany.hu-s sor ugyanerre.
 *
 * Ez a script csak a TÜNETET takarítja (2 sor → 1). A gyökérokot (sync-
 * kormanyhu-complaints.ts nem megy át a közös dedup/pending-gate-en) NEM
 * javítja — külön kódváltoztatás kell hozzá, l. a 2026-09-08-i Telegram-
 * eszmecserét.
 *
 * Kanonikus: 861c3b50 (kormany.hu — user 2026-08-30-i döntése szerint EZ az
 * elsődleges forrás a kormányzati bejelentőjű sorokra, szóról szóra egyező
 * összeggel: 3,67 Mrd Ft). Törölt: e8a65407 (24.hu, 3,5 Mrd Ft — kerekített/
 * pontatlanabb átvétel), forrása ráíródik a kanonikus sorra.
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

const KEEP_ID = '861c3b50-74be-43f2-9341-eabb15bcabfe';
const DELETE = {
  id: 'e8a65407-1625-4ab2-b736-7812f55e6251',
  sourceUrl: 'https://24.hu/belfold/2026/09/08/miniszterelnokseg-feljelentes-szuverenitasvedelmi-hivatal-balasy-gyula-lanczi-tamas',
  sourceName: '24.hu',
  sourceHeadline: 'Miniszterelnökség: feljelentés a Szuverenitásvédelmi Hivatal ellen',
  sourceDate: '2026-09-08',
};

async function main() {
  assertWriteTarget('merge-duplicate-complaints-2026-09-08');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  await sql`
    UPDATE "CriminalComplaint"
    SET "sourceUrls" = array_append("sourceUrls", ${DELETE.sourceUrl}),
        "sourceNames" = array_append("sourceNames", ${DELETE.sourceName}),
        "sourceHeadlines" = array_append("sourceHeadlines", ${DELETE.sourceHeadline}),
        "sourceDates" = array_append("sourceDates", ${DELETE.sourceDate}),
        "updatedAt" = now()
    WHERE id = ${KEEP_ID}
  `;
  const deleted = await sql`DELETE FROM "CriminalComplaint" WHERE id = ${DELETE.id} RETURNING id, "targetName"`;
  console.log('Törölve (egyesítve):', deleted[0]?.id, deleted[0]?.targetName);

  const [kept] = await sql`SELECT id, "targetName", "amountLabel", "sourceUrls" FROM "CriminalComplaint" WHERE id = ${KEEP_ID}`;
  console.log('Kanonikus sor:', kept?.targetName, kept?.amountLabel, kept?.sourceUrls);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
