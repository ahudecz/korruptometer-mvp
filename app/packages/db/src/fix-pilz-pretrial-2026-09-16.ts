/**
 * Egyszeri javítás — user report, 2026-09-16: "Pilz Tamás nincs előzetesben,
 * ha valakit kihallgatnak, attól még nem kerül előzetesbe."
 *
 * A 7c275b15 sor élesben így állt:
 *   verdictType   = 'előzetesben'   ← TÉNYBELILEG HIBÁS
 *   sentenceLabel = 'kihallgatás'   ← a saját sora mondta meg, hogy csak kihallgatás
 *
 * Az egyetlen forrás (24.hu, 2026-09-15, "RTL: Kihallgatták Tuzson Bence volt
 * államtitkárát…") kizárólag gyanúsítotti kihallgatásról ír. Kihallgatás ≠
 * letartóztatás: az előzetesről bíróság dönt, itt ilyen döntés nincs.
 *
 * A sor maga jogos (politikailag kötött személy elleni büntetőeljárás), csak a
 * szakasz volt félreminősítve, ezért NEM törlés, hanem visszaminősítés:
 *   verdictType   → 'egyéb'  (a VerdictList.tsx ilyenkor, 0 év büntetéssel,
 *                             "ELJÁRÁS ALATT" badge-et rajzol — ugyanaz a
 *                             kezelés, mint a Szivek Norbert-soré)
 *   sentenceLabel → 'gyanúsítottként kihallgatva'
 *   description   → ugyanez, a 7 szavas limiten belül
 *
 * Hatás a nyitóoldalra is: a "N fő előzetesben" számláló (page.tsx,
 * cross-promo.tsx, verdict-stats.ts) egyel kevesebbet mutat — helyesen.
 *
 * Idempotens: az UPDATE feltétele a jelenlegi hibás érték, újrafuttatva 0 sor.
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

const ROW_ID = '7c275b15-ab7a-4839-81c5-89d2b94ab447';

async function main() {
  assertWriteTarget('fix-pilz-pretrial-2026-09-16');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const updated = await sql`
    UPDATE "CourtVerdict"
    SET "verdictType" = 'egyéb',
        "sentenceLabel" = 'gyanúsítottként kihallgatva',
        "description" = 'Pilz Tamás: gyanúsítottként kihallgatva',
        "updatedAt" = now()
    WHERE id = ${ROW_ID} AND "verdictType" = 'előzetesben'
    RETURNING id, "personName", "verdictType", "sentenceLabel", "description"
  `;
  console.log(updated.length ? `Javítva: ${JSON.stringify(updated[0])}` : 'Nem volt mit javítani (már jó).');

  const check = await sql`
    SELECT count(*)::int AS n FROM "CourtVerdict"
    WHERE "reviewStatus" = 'approved' AND "verdictType" = 'előzetesben'
  `;
  console.log(`Előzetesben (approved) a javítás után: ${check[0].n} fő`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
