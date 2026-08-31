/**
 * Egyszeri, kézi javítás a PollOption táblán — user report 2026-08-31: a
 * Lázár János-opció amountLabel-je ("~3,3 Mrd Ft (közpénz) + 183 M Ft
 * (saját vásárlás)") túl hosszú volt, kilógott a szavazókártyából, és a
 * 183 M Ft-os saját-vásárlás rész amúgy is elhanyagolható a 3,3 Mrd Ft-os
 * közpénz-tételhez képest (már szerepel a leírás szövegében). Ez a sor
 * szinkronban tartja az élő adatot a seed-nvvh-poll.ts-ben módosított
 * forrás-értékkel.
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
  assertWriteTarget('fix-lazar-poll-amount-2026-08-31');
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const rows = await sql`
    UPDATE "PollOption"
    SET "amountLabel" = '~3,3 Mrd Ft'
    WHERE title = 'Lázár János megmagyarázhatatlan vagyonosodása'
    RETURNING id, title, "amountLabel"
  `;

  console.log('Frissítve:', rows);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
