import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../apps/web/.env.local') });
loadEnv({ path: resolve(__dirname, '../../../apps/web/.env') });
import postgres from 'postgres';

async function main() {
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const r = await conn.unsafe(`
    SELECT tag, headline
    FROM "NewsArticle"
    WHERE tag ILIKE '%NKA%'
    ORDER BY headline
    LIMIT 40
  `);

  console.log(`\nNKA-tagelt cikkek (${r.length} db):`);
  for (const x of r) {
    console.log(`  tag="${x.tag}" | ${(x.headline as string)?.slice(0, 90)}`);
  }

  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
