import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });

import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const existing = await sql`
    select id from "MediaClosure" where name = 'Mandiner — 60 újságíró elbocsátva' limit 1
  `;
  if (existing[0]) {
    console.log('Már létezik, kihagyva.');
    await sql.end();
    return;
  }

  await sql`
    insert into "MediaClosure" (name, "eventType", description, "eventDate", "sourceUrl", "sourceName")
    values (
      'Mandiner — 60 újságíró elbocsátva',
      'leépítés',
      '60 munkatársat bocsátott el Kohán Mátyás főszerkesztő — az MCC égisze alatt zajló propagandamédia-átszervezés részeként.',
      '2026-06-24T00:00:00+02:00',
      'https://24.hu/belfold/2026/06/24/mendiber-leepites-mcc-fidesz-propaganda-kohan-matyas/',
      '24.hu'
    )
  `;
  console.log('Beillesztve: Mandiner leépítés.');

  await sql.end();
}

main().catch(console.error);
