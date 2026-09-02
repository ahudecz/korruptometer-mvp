import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';
import { assertWriteTarget } from './guard';

/**
 * 2026-09-02 user report (birosagi-iteletek "Legnagyobb feljelentők" számolás
 * ellenőrzésekor derült ki): a "Hadházy" (rövid alak, 1 feljelentés — Tiborcz/
 * Alteo-részvény ügy) és a "Hadházy Ákos" (3 feljelentés) ugyanaz a személy,
 * csak eltérő névalakkal — a filerName-egyeztetés (isSameComplainant) ezt a
 * rövid alakot nem ismerte fel. Nem törlés, csak névnormalizálás.
 */
async function main() {
  assertWriteTarget('merge-duplicate-complaints-2026-09-02-hadhazy');
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const check = await conn<{ id: string; targetName: string; filerName: string }[]>`
    SELECT id, "targetName", "filerName" FROM "CriminalComplaint" WHERE "filerName" = 'Hadházy'
  `;
  if (check.length === 0) {
    console.log('Nincs "Hadházy" filerName-ű sor — nincs teendő.');
    await conn.end();
    return;
  }
  for (const r of check) console.log(`  Javítás: [${r.id}] ${r.targetName} — "Hadházy" → "Hadházy Ákos"`);

  await conn`UPDATE "CriminalComplaint" SET "filerName" = 'Hadházy Ákos', "updatedAt" = now() WHERE "filerName" = 'Hadházy'`;
  console.log(`✅ ${check.length} sor javítva.`);

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
