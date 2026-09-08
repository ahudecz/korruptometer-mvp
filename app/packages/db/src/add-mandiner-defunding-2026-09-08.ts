/**
 * Egyszeri, kézi felvétel + javítás a MediaClosure táblán — user jelzés,
 * 2026-09-08.
 *
 * 1) ÚJ SOR: 2026-09-04 — a pénzügyminiszter utasítására felmentették a
 *    Mandiner kiadójának vezérigazgatóját, és Magyar Péter bejelentette,
 *    hogy leáll a lap minden állami finanszírozása (4 független forrás:
 *    telex.hu, 24.hu, 444.hu, kontroll.hu — mind 2026-09-04-i). Ez a sor
 *    korábban HIÁNYZOTT a táblából (a meglévő 2 Mandiner-sor egyike sem
 *    fedi ezt az eseményt: az egyik 2026-08-03-i nyomtatott lap-megszűnés,
 *    a másik 2026-06-23-i, 60 fős leépítés). `pinned: true`, hogy a
 *    homepage "Kiemelt megszűnések" ÉS "Legfrissebb megszűnések" (a
 *    `getCachedLatestClosures` nem zárja ki a pinnelt sorokat) blokkjában
 *    is megjelenjen — user explicit kérése.
 *
 * 2) JAVÍTÁS: a meglévő 2026-08-03-i "Mandiner" (megszűnés) sor
 *    description mezője a 7 szavas limit (migráció 0034) miatt
 *    grammatikailag befejezetlen mondatra lett vágva ("A Mandiner hetilap
 *    ezen a héten már") — ez egy korábbi kézi/automata beszúrás hibája,
 *    a user jelenlegi kérésétől függetlenül talált mellékes hiba, most
 *    javítva egy rövidebb, teljes mondatra.
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

const TRUNCATED_ROW_ID = '7790174d-1668-41df-ad2a-15072817d455';

async function main() {
  assertWriteTarget('add-mandiner-defunding-2026-09-08');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const inserted = await sql`
    INSERT INTO "MediaClosure" (name, "eventType", description, "eventDate", "sourceUrl", "sourceName", pinned, "reviewStatus")
    VALUES (
      'Mandiner — vezérigazgató felmentve',
      'leépítés',
      'Leállt a kiadó állami finanszírozása',
      '2026-09-04T00:00:00Z',
      'https://telex.hu/belfold/2026/09/04/felmentettek-a-mandiner-kiadojanak-vezerigazgatojat',
      'Telex',
      true,
      'approved'
    )
    RETURNING id, name, "eventDate"
  `;
  console.log('Beszúrva:', inserted[0]?.name, inserted[0]?.eventDate);

  const fixed = await sql`
    UPDATE "MediaClosure"
    SET description = 'Nem jelenik meg többé a hetilap', "updatedAt" = now()
    WHERE id = ${TRUNCATED_ROW_ID}
    RETURNING id, name, description
  `;
  console.log('Javítva (levágott leírás):', fixed[0]?.name, '→', fixed[0]?.description);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
