import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });

import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const r = await sql`
    UPDATE "NewsArticle"
    SET "imageUrl" = 'https://assets.telex.hu/images/20260623/1782230393-temp-6oesleh6gpk9dcenaad_facebook.jpg'
    WHERE "sourceUrl" = 'https://telex.hu/belfold/2026/06/23/nka-botrany-hat-szemelyt-orizetbe-vett-a-nav-hanko-balazs-tarr-zoltan'
    RETURNING id, headline
  `;
  console.log('Frissítve:', r[0]);

  await sql.end();
}
main().catch(console.error);
