import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';

async function main() {
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const r = await conn.unsafe(`
    SELECT tag, length(tag) as len, encode(tag::bytea, 'hex') as hex, headline
    FROM "NewsArticle"
    WHERE tag ILIKE '%zlet%' OR tag ILIKE '%eggeli%' OR tag ILIKE '%arri%'
    LIMIT 10
  `);

  for (const row of r) {
    console.log(`tag="${row.tag}" len=${row.len} hex=${row.hex} | ${row.headline?.slice(0, 50)}`);
  }

  // Próba: töröljük ILIKE-kal
  const check = await conn.unsafe(`
    SELECT count(*)::int as n FROM "NewsArticle"
    WHERE tag ILIKE 'üzlet' OR tag ILIKE 'reggeli' OR tag ILIKE 'karrier'
  `);
  console.log('\nILIKE match:', check[0].n);

  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
