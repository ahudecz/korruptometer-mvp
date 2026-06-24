import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  // Update Tarr Zoltán entry from 400M to 470M so total = 1,690M + 470M = 2,160M = 2.16 mrd
  const res = await sql`
    update "AssetRecovery"
    set "amountFt" = 470000000,
        "caseLabel" = 'NKA · Tarr Zoltán visszavont',
        description = 'Hankó Balázs választás előtti osztogatásából visszavont — végleges összeg'
    where "caseId" = 'nka-botrany'
      and "caseLabel" = 'NKA · Tarr Zoltán visszavont'
    returning id, "amountFt"
  `;
  if (res[0]) {
    console.log(`Frissítve: Tarr → ${res[0].amountFt} Ft`);
  } else {
    console.log('Nem találtam a Tarr-bejegyzést.');
  }

  const total = await sql`
    select sum("amountFt") as total from "AssetRecovery" where "caseId" = 'nka-botrany'
  `;
  console.log('NKA összesen:', Number(total[0].total) / 1_000_000_000, 'Mrd Ft');

  await sql.end();
}
main().catch(console.error);
