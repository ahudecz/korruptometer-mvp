import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';

// Megtartjuk: 444 és HVG (legjobb minőség + legtöbb infó)
// Töröljük: hang.hu, media1.hu, nepszava.hu verziókat
const DELETE_URLS = [
  'https://hang.hu/belfold/elbocsatjak-a-pestisracok-osszes-munkavallalojat-189678',
  'https://media1.hu/2026/06/16/elbocsatasok-a-vilaggazdasagnal-es-a-pestisracoknal-utobbinal-mindenkitol-megvalt-a-mediaworks/',
  'https://nepszava.hu/3326064_pestisracok-csoportos-letszamleepites-mediaworks-huth-gergely',
];

async function main() {
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  for (const url of DELETE_URLS) {
    const result = await conn`
      DELETE FROM "NewsArticle" WHERE "sourceUrl" = ${url} RETURNING headline
    `;
    if (result.length > 0) {
      console.log(`✅ Törölve: ${result[0].headline?.slice(0, 70)}`);
    } else {
      console.log(`⚠️  Nem található: ${url.slice(0, 60)}`);
    }
  }

  const [{ n }] = await conn`SELECT count(*)::int as n FROM "NewsArticle"`;
  console.log(`\nMaradó cikkek: ${n}`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
