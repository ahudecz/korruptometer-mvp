import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  const dups = await sql`SELECT "postUrl", COUNT(*) as cnt FROM "SocialPost" GROUP BY "postUrl" HAVING COUNT(*) > 1`;
  if (dups.length === 0) console.log('Nincs duplikátum — migráció biztonságos');
  else console.log('DUPLIKÁTUMOK:', JSON.stringify(dups));
  await sql.end();
}
main().catch(console.error);
