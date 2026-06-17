import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';

// Ezek konkrétan nem ide valók — headline alapján töröljük
const JUNK_HEADLINES = [
  '%Sheinnel%',
  '%Fuller Bianka%',
  '%vonatpótló%',
  '%Vitézy Dávid leállított%',
  '%EU%USA%vám%',
  '%Waberer%',
  '%brit védelmi miniszter%',
];

async function main() {
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  for (const pattern of JUNK_HEADLINES) {
    const check = await conn.unsafe(
      `SELECT id, headline FROM "NewsArticle" WHERE headline ILIKE $1`,
      [pattern],
    );
    if (check.length === 0) continue;

    for (const r of check) console.log(`  Törlés: ${r.headline?.slice(0, 80)}`);

    await conn.unsafe(`DELETE FROM "NewsArticle" WHERE headline ILIKE $1`, [pattern]);
    console.log(`  ✅ Törölve: ${check.length} cikk`);
  }

  // Zárszó
  const [{ n }] = await conn`SELECT count(*)::int as n FROM "NewsArticle"`;
  console.log(`\nMaradó cikkek: ${n}`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
