/**
 * Egyszeri javítás: PoliticalResignation.description mezőben 5 sor
 * grammatikailag hibás/félreérthető volt — l. resignation-detect.ts
 * 2026-07-30-i prompt-kiegészítése (user report).
 *
 * Két hibaosztály:
 * 1. "Felmentette tisztségéből..." — egyes számú, tárgyas igealak alany
 *    nélkül, befejezetlen mondat (2 sor).
 * 2. "Felmentette Magyar Péter, ..." — a döntéshozó neve szerepel, de
 *    rossz szórendben, úgy olvasható, mintha ŐT mentették volna fel (3 sor).
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

const FIXES: Array<{ id: string; description: string }> = [
  { id: '1fe3aeca-a503-4847-903b-e979f152a1c6', description: 'Felmentették tisztségéből és másik szervezetbe helyezték át' },
  { id: '1030ce04-2adc-41ba-bd99-646523fb3d8d', description: 'Felmentették tisztségéből, de más megbízatást kapott' },
  { id: '98311bbd-e956-4daf-8d39-a1d0c6815378', description: 'Magyar Péter felmentette tisztségéből, június 13-tól.' },
  { id: 'df5eacfd-d171-4a82-a9a0-ac3c9b65b426', description: 'Magyar Péter felmentette tisztségéből, június 13-tól.' },
  { id: '4752e5b6-e53d-40a1-baec-7c458da2bb05', description: 'Magyar Péter felmentette tisztségéből, június 13-tól.' },
];

async function main() {
  assertWriteTarget('fix-description-grammar-2026-07-30');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  for (const fix of FIXES) {
    const result = await sql`
      UPDATE "PoliticalResignation" SET "description" = ${fix.description}, "updatedAt" = now()
      WHERE id = ${fix.id}
      RETURNING "name", "description"
    `;
    console.log(result[0]?.name, '→', result[0]?.description);
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
