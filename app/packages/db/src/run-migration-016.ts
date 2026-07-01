import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  const migration = readFileSync(
    resolve(__dirname, '../../../supabase/migrations/0016_social_post_hidden.sql'),
    'utf-8',
  );
  await sql.unsafe(migration);
  console.log('0016_social_post_hidden.sql migráció sikeresen lefutott');
  await sql.end();
}
main().catch(console.error);
