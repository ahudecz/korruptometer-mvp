import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';
import { assertWriteTarget } from './guard';

/**
 * A Volánbusz-ügy feljelentés-sora "<UNKNOWN>" feljelentővel került be és
 * publikusan így is jelent meg a /birosagi-iteletek oldalon (user report,
 * 2026-09-10). A feljelentők NEVE BENNE VAN a forráscikkben:
 *
 *   "Az ügyben a Volánbusz, a Volán Buszpark és a Kormányzati Ellenőrzési
 *    Hivatal is tett feljelentést."
 *   — kontroll.hu, 2026-09-10 (a sor sourceUrls-ében szereplő cikk,
 *     szó szerint visszaolvasva a publikált szövegből)
 *
 * A detektor azért nem találta meg, mert a placeholder-guard eddig csak az
 * ELSŐDLEGES névmezőre (targetName) futott, a `filerName` csak puszta
 * truthiness-t kapott — így a "<UNKNOWN>" nem is minősült hiányos
 * találatnak, tehát a teljes cikk letöltése (isIncomplete → full-text
 * fetch) sem indult el, pedig az megoldotta volna. A guard mind a négy
 * hívási helyen kiterjesztve (l. detection-check.ts fejléce).
 */
const COMPLAINT_ID = '237b4838-0cac-4ad2-a761-c32ee0ff3083';
const FILER = 'Volánbusz, Volán Buszpark, Kormányzati Ellenőrzési Hivatal';

async function main() {
  assertWriteTarget('fix-volanbusz-filer-2026-09-10');
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const rows = await conn`
    UPDATE "CriminalComplaint"
    SET "filerName" = ${FILER}
    WHERE id = ${COMPLAINT_ID}
    RETURNING id, "targetName", "filerName"
  `;

  if (rows.length === 0) {
    console.log(`⚠️  Nem található: ${COMPLAINT_ID}`);
  } else {
    console.log(`✅ ${rows[0]?.targetName} → feljelentő: ${rows[0]?.filerName}`);
  }

  // Biztonsági háló: maradt-e még placeholder-feljelentő a táblában?
  const leftovers = await conn`
    SELECT id, "targetName", "filerName" FROM "CriminalComplaint"
    WHERE lower(trim(both '<>' from "filerName")) IN ('', 'unknown', 'ismeretlen', 'n/a', 'null', 'undefined')
  `;
  console.log(`Maradék placeholder-feljelentő: ${leftovers.length}`);
  for (const r of leftovers) console.log(`   - ${r.id} ${r.targetName} (${r.filerName})`);

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
