import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';
import { assertWriteTarget } from './guard';

/**
 * 2026-09-03 user report: egy friss "Gondosóra program — korrupciógyanús
 * ügyek" (id 6d5b98c8, 100 milliárd Ft, "Integritás Hatóság") sor rossz
 * forrással ment élesre — a hozzá tartozó sourceUrl valójában a
 * 2026-09-02-i Havasi Bertalan/NAIH-nyilatkozatról szóló Telex-cikk, ami
 * SEHOL nem említ 100 milliárd forintot. Gyökérok: ez a sor ténylegesen
 * DUPLIKÁTUMA a 2026-08-11 óta élő "Gondosóra-program üzemeltetése —
 * Kormányzati Szolgáltató Központ és Juhász Roland ügyvezető" sornak (id
 * 953a627d) — ugyanaz a tényleges esemény (KSZK-vezető felmentése, 100
 * milliárd Ft hűtlen kezelés gyanúja), csak a dedup-matcher nem ismerte fel
 * (más targetName, más filerName: "Integritás Hatóság" vs "Tudományos és
 * Technológiai Minisztérium (Tanács Zoltán)"). A user által adott HVG-cikk
 * (2026-08-10, "100 milliárdos hűtlen kezelés... felmentették... a KSZK
 * vezetőjét") pontosan a MEGLÉVŐ (953a627d) sorhoz tartozik — dátum és
 * tartalom is egyezik.
 *
 * Ez a script: (1) törli a rossz-forrású duplikátumot; (2) hozzáadja a HVG
 * forrást a valódi sorhoz.
 */
const DUPLICATE_ID = '6d5b98c8-b787-47cf-af1a-7f480e53aede';
const REAL_ID = '953a627d-689e-4397-8ad8-2eecae447085';
const HVG_URL = 'https://hvg.hu/itthon/20260810_100-milliardos-hutlen-kezeles-miatt-feljelentest-tettek-a-gondosora-program-ugyeben-felmentettek-az-uzemelteteseert-felelos-kszk-vezetojet';
const HVG_HEADLINE = '100 milliárdos hűtlen kezelés miatt feljelentést tettek a Gondosóra program ügyében, felmentették az üzemeltetéséért felelős KSZK vezetőjét';

async function main() {
  assertWriteTarget('fix-gondosora-duplicate-2026-09-03');
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const dup = await conn<{ id: string; targetName: string }[]>`SELECT id, "targetName" FROM "CriminalComplaint" WHERE id = ${DUPLICATE_ID}`;
  const real = await conn<{ id: string; targetName: string; "sourceUrls": string[] }[]>`SELECT id, "targetName", "sourceUrls" FROM "CriminalComplaint" WHERE id = ${REAL_ID}`;
  if (dup.length === 0 || real.length === 0) {
    console.error('⚠️ Az egyik sor nem található — megszakítom.');
    process.exit(1);
  }
  console.log(`Törlés (duplikátum): [${dup[0]!.id}] ${dup[0]!.targetName}`);
  console.log(`Bővítés (valódi sor): [${real[0]!.id}] ${real[0]!.targetName}`);

  if (real[0]!.sourceUrls.includes(HVG_URL)) {
    console.log('HVG-forrás már szerepel a valódi sorban — csak a duplikátumot törlöm.');
  } else {
    await conn`
      UPDATE "CriminalComplaint"
      SET "sourceUrls" = array_append("sourceUrls", ${HVG_URL}),
          "sourceNames" = array_append("sourceNames", 'HVG'),
          "sourceHeadlines" = array_append("sourceHeadlines", ${HVG_HEADLINE}),
          "sourceDates" = array_append("sourceDates", '2026-08-10'),
          "updatedAt" = now()
      WHERE id = ${REAL_ID}
    `;
    console.log('✅ HVG-forrás hozzáadva a valódi sorhoz.');
  }

  await conn`DELETE FROM "CriminalComplaint" WHERE id = ${DUPLICATE_ID}`;
  console.log('✅ Duplikátum törölve.');

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
