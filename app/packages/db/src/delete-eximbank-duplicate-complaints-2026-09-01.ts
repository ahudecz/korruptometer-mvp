import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';
import { assertWriteTarget } from './guard';

/**
 * 2026-09-01 user report: a criminal_complaint.detect (LLM-alapú) detektor
 * a 444.hu "hivatali visszaélés és hűtlen kezelés miatt nyomoz a rendőrség
 * az Eximbank ellen" c. cikkéből (ami ténylegesen a július 23-i, MÁR
 * felvett GEM-feljelentések nyomozás-indulásáról szóló KÖVETŐ hír, nem új
 * feljelentés) két hamis duplikátum sort szúrt be:
 *
 * 1) "Tiborcz-érdekeltségnek villámgyorsan adott hitel - Eximbank"
 *    (60 milliárd Ft) — ugyanaz az ügy, mint a már meglévő
 *    "Tiborcz István-közeli cég (Sofitel szálloda) — Eximbank gyorsdöntés"
 *    sor (id 0b12fee6, GEM, 60 milliárd Ft, létrehozva 2026-07-23).
 *    Gyökérok: findExistingComplaint() csak a top-1 wsim-kandidátust nézi —
 *    a Sofitel sor wsim=0.253 volt, de két MÁS, valójában független
 *    Eximbank-ügy (Duna Aszfalt/Zambia-Kongó, Dunakeszi vasúti kocsik)
 *    generikus szóátfedés miatt 0.259-et kapott, tehát ELLOPTA a "best"
 *    helyet a valódi találattól — ugyanaz a hibaosztály, mint amit
 *    kormanyhu-match.ts findBestMatch()-ben 2026-08-30-án már javítottunk,
 *    de ide sosem lett átültetve.
 *
 * 2) "Eximbank ellen nyomozás - hivatali visszaélés és hűtlen kezelés"
 *    (239,2 millió Ft) — a cikk valójában a 4 július eleji GEM-ügy (köztük
 *    a fenti Sofitel-ügy) nyomozás-indulásáról szól összefoglalóan, "239,2
 *    millió Ft" sehol nem szerepel a cikkben (ellenőrizve). Gyökérok:
 *    findExistingComplaint() nyers pg_trgm word_similarity()-t használ
 *    stopword-szűrés NÉLKÜL — a "hivatali visszaélés" generikus kifejezés
 *    egy TELJESEN független ügyre (Simonka György) 0.364 wsim-et adott,
 *    ami a FUZZY_HIGH (0.27) fölött automatikus (AI-tiebreak nélküli)
 *    "match"-nek számított — a bejelentő-ellenőrzés (Hadházy Ákos vs "a
 *    kormány") ezt helyesen elutasította, de emiatt a sor ÚJ ügyként lett
 *    felvéve ahelyett, hogy a valódi (Sofitel) sorral próbált volna
 *    egyeztetni.
 *
 * Ez a script CSAK ezt a két konkrét sort törli id szerint — l. user
 * jóváhagyás a chatben.
 */
const IDS_TO_DELETE = [
  '0e1fca23-c84c-4d77-ba45-e7a899846562', // Tiborcz-érdekeltségnek villámgyorsan adott hitel - Eximbank
  'd80813c0-a6f5-436a-8a5c-020d505b8c47', // Eximbank ellen nyomozás - hivatali visszaélés és hűtlen kezelés
];

async function main() {
  assertWriteTarget('delete-eximbank-duplicate-complaints-2026-09-01');
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const check = await conn<{ id: string; targetName: string; filerName: string; amountLabel: string | null }[]>`
    SELECT id, "targetName", "filerName", "amountLabel" FROM "CriminalComplaint" WHERE id = ANY(${IDS_TO_DELETE})
  `;
  if (check.length !== IDS_TO_DELETE.length) {
    console.error(`⚠️ Csak ${check.length}/${IDS_TO_DELETE.length} sor található — megszakítom.`);
    process.exit(1);
  }
  for (const r of check) console.log(`  Törlés: [${r.id}] ${r.targetName} (${r.filerName}, ${r.amountLabel})`);

  const deleted = await conn`DELETE FROM "CriminalComplaint" WHERE id = ANY(${IDS_TO_DELETE})`;
  console.log(`✅ Törölve: ${deleted.count} sor`);

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
