/**
 * Egyszeri, kézi javítás a CriminalComplaint táblán — user által jelzett
 * hiányzó feljelentések, 2026-08-11.
 *
 * 1. Új sor: Tudományos és Technológiai Minisztérium feljelentése a
 *    Gondosóra-program üzemeltetője és ügyvezetője ellen. A detektor
 *    LEFUTOTT ezen a cikken (DetectionCheck: outcome=discarded,
 *    reason=stale_status), de tévesen a 2026-07-16-i Integritás Hatóság
 *    -feljelentéssel (880c1cba) egyeztette össze fuzzy targetName-matchen
 *    keresztül — mindkettő 'feljelentés' státuszú, ezért a monoton
 *    state machine "nem előrehaladó"-nak (stale) ítélte, pedig ez egy
 *    MÁSODIK, FÜGGETLEN feljelentés (más feljelentő). Root cause fixelve
 *    review.ts-ben (isSameComplainant), ez a sor a hibás run pótlása.
 * 2. Új sor: Miniszterelnökség feljelentése Orbán Viktor közösségi médiás
 *    tartalomgyártásának szerződése ügyében (Triton Communications /
 *    Kaminski Fanny). A cikk 2026-08-11-i, még nincs lescrape-elve.
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
  assertWriteTarget('manual-complaints-2026-08-11');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  // 1. Gondosóra — Tudományos és Technológiai Minisztérium feljelentése.
  const gondosora = await sql`
    INSERT INTO "CriminalComplaint" (
      "targetName", "filerName", "description", "amountLabel", "status",
      "eventDate", "filedAt", "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates",
      "reviewStatus"
    ) VALUES (
      'Gondosóra-program üzemeltetése — Kormányzati Szolgáltató Központ és Juhász Roland ügyvezető',
      'Tudományos és Technológiai Minisztérium (Tanács Zoltán)',
      'A Tudományos és Technológiai Minisztérium feljelentést tett a Gondosóra-programot üzemeltető Kormányzati Szolgáltató Központ Nonprofit Kft. és ügyvezetője, dr. Juhász Roland ellen költségvetési csalás, hűtlen kezelés, hanyag kezelés, számvitel rendjének megsértése és további, közpénzeket érintő bűncselekmények gyanúja miatt. A miniszter szerint a kár meghaladhatja a 100 milliárd forintot. Juhász Rolandot azonnali hatállyal felmentették, helyét Vitkovics Péter vette át; a programot nem szüntetik meg, hanem átalakítják. Az Integritás Hatóság korábban, 2026 júliusában már tett egy önálló feljelentést ugyanebben az ügyben.',
      '100+ milliárd Ft (becsült kár)',
      'feljelentés',
      '2026-08-10T00:00:00Z',
      '2026-08-10T00:00:00Z',
      ARRAY['https://telex.hu/gazdasag/2026/08/10/tudomanyos-es-technologiai-miniszterium-feljelentes-gondosora-program-ugyvezeto-felmentes'],
      ARRAY['Telex'],
      ARRAY['Súlyos szabálytalanságokat tárt fel, feljelentést tett Gondosóra-ügyben Tanács Zoltán minisztériuma'],
      ARRAY['2026-08-11'],
      'approved'
    )
    RETURNING id, "targetName"
  `;
  console.log('Beszúrva:', gondosora[0]?.id, gondosora[0]?.targetName);

  // 2. Orbán Viktor közösségi médiás tartalomgyártása — Miniszterelnökség feljelentése.
  const orban = await sql`
    INSERT INTO "CriminalComplaint" (
      "targetName", "filerName", "description", "amountLabel", "status",
      "eventDate", "filedAt", "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates",
      "reviewStatus"
    ) VALUES (
      'Orbán Viktor közösségi médiás tartalomgyártása — Triton Communications (Kaminski Fanny)',
      'Miniszterelnökség (Ruff Bálint)',
      'A Ruff Bálint vezette Miniszterelnökség hűtlen kezelés és hivatali visszaélés gyanúja miatt feljelentést tett ismeretlen tettes ellen a Rogán Antal vezette Miniszterelnöki Kabinetiroda és a Kaminski Fanny egyedüli tulajdonában lévő Triton Communications 2022 óta fennálló szerződése ügyében. A szerződés Orbán Viktor közösségi médiás tartalmainak gyártásáról szól, havi 63,68 millió forintról indult, majd négy hosszabbítás után 86,49 millió forintra nőtt — összesen bruttó 4,228 milliárd forint közpénzt tett ki 44 hónap alatt. A cég teljesítése (havonta kb. 21 perc videó és 411 fotó) feltűnően aránytalan az összeghez képest; a Triton bevétele 2021 és 2025 között 20 millióról 1,087 milliárd forintra nőtt.',
      '4,228 milliárd Ft (44 hónap alatt, 2022 óta)',
      'feljelentés',
      '2026-08-11T00:00:00Z',
      '2026-08-11T00:00:00Z',
      ARRAY['https://telex.hu/belfold/2026/08/11/feljelentes-orban-viktor-kozossegi-media-miniszterelnokseg'],
      ARRAY['Telex'],
      ARRAY['Feljelentést tett a Miniszterelnökség Orbán Viktor közösségi médiás tartalomgyártása miatt'],
      ARRAY['2026-08-11'],
      'approved'
    )
    RETURNING id, "targetName"
  `;
  console.log('Beszúrva:', orban[0]?.id, orban[0]?.targetName);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
