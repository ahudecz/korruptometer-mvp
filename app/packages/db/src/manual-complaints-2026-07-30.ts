/**
 * Egyszeri, kézi javítás a CriminalComplaint táblán — user által megadott
 * tények, 2026-07-30.
 *
 * 1. Törli a "Bedőlt orosz–magyar vasúti projekt" sort (f7668976) — a
 *    hvg.hu/gazdasag/20260723_magyar-peter-...-eximbank-feljelentes cikk
 *    ugyanazt a 2026-07-23-i GEM-Eximbank feljelentés-sorozatot foglalja
 *    össze, amit a telex.hu cikk alapján már 4 külön sorban felvettünk
 *    (Eximbank/Macedónia, Dunakeszi/Egyiptom, Duna Aszfalt/Zambia,
 *    Tiborcz/Sofitel) — duplikátum.
 * 2. Kiegészíti a már meglévő "Élelmiszermentő Központ" sort (14c0850b) a
 *    user által megadott pontos összegekkel (2,8 mrd + 4,6 mrd Ft) és
 *    további ÁSZ-megállapításokkal, plusz a forbes.hu forrással.
 * 3. Új sor: Vác Város Labdarúgó Sportegyesület (ÁSZ feljelentés).
 * 4. Új sor: Letelepedési államkötvények (Transparency International
 *    ismételt feljelentése).
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

async function main() {
  assertWriteTarget('manual-complaints-2026-07-30');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  // 1. Duplikátum törlése.
  const deleted = await sql`
    DELETE FROM "CriminalComplaint"
    WHERE id = 'f7668976-f87a-4b80-83e1-77193241217f'
    RETURNING "targetName"
  `;
  console.log('Törölve:', deleted[0]?.targetName ?? '(nem található)');

  // 2. Élelmiszermentő Központ sor kiegészítése.
  const updated = await sql`
    UPDATE "CriminalComplaint" SET
      "amountLabel" = COALESCE("amountLabel", '2,8 milliárd Ft (informatikai rendszer) + 4,6 milliárd Ft (üzemeltetés)'),
      "description" = "description" || ' Az ÁSZ megállapította, hogy a 2,8 milliárd forintból fejlesztett informatikai rendszer működését nem igazolták, emellett a társaság további 4,6 milliárd forintot fizetett ki a rendszer üzemeltetésére úgy, hogy a hozzáférése sem volt biztosított. Az ÁSZ emellett a nemzeti vagyonnal való felelős gazdálkodás hiányát, a belső kontrollrendszer hiányosságait, nem igazolt feladatellátásra történt kifizetéseket és számviteli szabálytalanságokat is feltárt; az ügyet az illetékes hatóságokhoz és a Közbeszerzési Döntőbizottsághoz is továbbították.',
      "sourceUrls" = array_append("sourceUrls", 'https://www.forbes.hu/uzlet/koltsegvetesi-csalas-gyanuja-es-milliardos-kifizetesek-miatt-lepett-az-asz/'),
      "sourceNames" = array_append("sourceNames", 'Forbes'),
      "sourceHeadlines" = array_append("sourceHeadlines", 'Költségvetési csalás gyanúja és milliárdos kifizetések miatt lépett az ÁSZ'),
      "sourceDates" = array_append("sourceDates", '2026-07-30'),
      "updatedAt" = now()
    WHERE id = '14c0850b-802f-4865-9226-3f21439b2b30'
    RETURNING "targetName", "amountLabel"
  `;
  console.log('Frissítve:', updated[0]?.targetName, '| amountLabel:', updated[0]?.amountLabel);

  // 3. Új sor: Vác Város Labdarúgó Sportegyesület.
  const vac = await sql`
    INSERT INTO "CriminalComplaint" (
      "targetName", "filerName", "description", "amountLabel", "status",
      "eventDate", "filedAt", "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates",
      "reviewStatus"
    ) VALUES (
      'Vác Város Labdarúgó Sportegyesület — sportfejlesztési támogatások hamis igazolása',
      'Állami Számvevőszék (ÁSZ)',
      'Az ÁSZ ellenőrzése súlyos gazdálkodási visszaéléseket tárt fel a Vác Város Labdarúgó Sportegyesületnél: a fociklub a sportfejlesztési támogatásokat valószínűleg nem a kijelölt célokra fordította, a hatóságok felé pedig hamis banki dokumentumokat mutatott be igazolásként. Mintegy 270 millió forintos költségvetési csalás gyanúja merült fel, ezért az ÁSZ bűncselekmény gyanúja miatt megtette a szükséges lépéseket.',
      '270 millió Ft',
      'feljelentés',
      '2026-07-29T00:00:00Z',
      '2026-07-29T00:00:00Z',
      ARRAY['https://hvg.hu/itthon/20260729_asz-allami-szamvevoszek-vizsgalat-ellenorzes-hianyossagok-feljelentes'],
      ARRAY['HVG'],
      ARRAY[]::text[],
      ARRAY['2026-07-30'],
      'approved'
    )
    RETURNING id, "targetName"
  `;
  console.log('Beszúrva:', vac[0]?.id, vac[0]?.targetName);

  // 4. Új sor: Letelepedési államkötvények.
  const bonds = await sql`
    INSERT INTO "CriminalComplaint" (
      "targetName", "filerName", "description", "amountLabel", "status",
      "eventDate", "filedAt", "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates",
      "reviewStatus"
    ) VALUES (
      'Letelepedési államkötvények forgalmazása — hűtlen kezelés gyanúja',
      'Transparency International Magyarország',
      'A Transparency International Magyarország ismételt feljelentést tesz a letelepedési államkötvények 2013–2017 közötti forgalmazásával megvalósított hűtlen kezelés gyanúja miatt, mivel a bűncselekmény büntethetősége elévüléshez közelít. A programot lehetővé tevő törvénymódosítást Rogán Antal jegyezte 2012-ben; a kizárólag off-shore hátterű brókercégek kötvénycsomagonként 29 ezer eurót kerestek (összesen mintegy 192 millió euró, kb. 60 milliárd Ft extraprofit), miközben az állam a piacinál magasabb kamat miatt összesen 66,5 millió euró, mintegy 21 milliárd forint nettó relatív veszteséget szenvedett el. A program biztonsági hiányosságai miatt olyan külföldiek is magyar letelepedési engedélyhez jutottak, mint Szergej Nariskin orosz hírszerzésvezető családtagjai és Atiya Khoury, Aszad szíriai diktátor bukott pénzembere.',
      '~60 milliárd Ft',
      'feljelentés',
      '2026-07-30T00:00:00Z',
      '2026-07-30T00:00:00Z',
      ARRAY['https://transparency.hu/hirek/last-minute-feljelentes-a-letelepedesi-allamkotvenyek-ugyeben/'],
      ARRAY['Transparency International Magyarország'],
      ARRAY[]::text[],
      ARRAY['2026-07-30'],
      'approved'
    )
    RETURNING id, "targetName"
  `;
  console.log('Beszúrva:', bonds[0]?.id, bonds[0]?.targetName);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
