import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  // Visszaállítjuk Tarr Zoltán tételét 400M-ra (előző hibás módosítás)
  await sql`
    update "AssetRecovery"
    set "amountFt" = 400000000,
        description = 'Hankó Balázs választás előtti osztogatásából visszatartott — Tarr Zoltán új miniszter intézkedése'
    where "caseId" = 'nka-botrany' and "caseLabel" = 'NKA · Tarr Zoltán visszavont'
  `;
  console.log('Tarr tétel visszaállítva: 400 000 000 Ft');

  // A pályázók visszautaltak összege: 1.69 mrd → 2.16 mrd
  await sql`
    update "AssetRecovery"
    set "amountFt" = 2160000000,
        description = 'Kis-Grófo, Városliget Zrt. és mások — összesen 49+ pályázó visszafizetett'
    where "caseId" = 'nka-botrany' and "caseLabel" = 'NKA · pályázók visszautaltak'
  `;
  console.log('Pályázók tétel frissítve: 2 160 000 000 Ft');

  const total = await sql`
    select sum("amountFt") as total from "AssetRecovery" where "caseId" = 'nka-botrany'
  `;
  console.log('NKA összesen:', Number(total[0].total) / 1_000_000_000, 'Mrd Ft');

  await sql.end();
}
main().catch(console.error);
