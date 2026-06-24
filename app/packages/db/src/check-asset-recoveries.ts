import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  const tabs = await sql`select tablename from pg_tables where schemaname='public'`;
  console.log('Tables:', tabs.map((r: any) => r.tablename).join(', '));
  try {
    const rows = await sql`select * from "AssetRecovery" order by "recoveredAt" desc`;
    console.log('AssetRecovery rows:', JSON.stringify(rows, null, 2));
  } catch (e: any) {
    console.log('AssetRecovery error:', e.message);
  }
  await sql.end();
}
main().catch(console.error);
