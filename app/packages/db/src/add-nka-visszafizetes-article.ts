import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
import { createHash } from 'node:crypto';
import postgres from 'postgres';

function urlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 32);
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const url = 'https://telex.hu/belfold/2026/05/23/nka-palyazati-penzek-visszafizetes-kis-grofo-varosliget-zrt';
  const hash = urlHash(url);

  const ex = await sql`select id from "NewsArticle" where "sourceUrlHash" = ${hash} limit 1`;
  if (ex[0]) {
    console.log('Már létezik, kihagyva.');
    await sql.end();
    return;
  }

  const src = await sql`select id from "Source" where slug = 'telex' limit 1`;
  if (!src[0]) { console.log('Telex forrás nem található!'); await sql.end(); return; }

  await sql`
    insert into "NewsArticle"
      ("sourceId", headline, excerpt, "sourceUrl", "sourceUrlHash", "publishedAt", tag, featured, "breakingOverride", "isBreakingCandidate")
    values (
      ${src[0].id},
      'Visszafizették a 17 milliárdos NKA pályázati pénzek tizedét, Kis Grófo is visszaadott 5 millió forintot',
      '49 pályázó összesen 1,69 milliárd forintot utalt vissza az NKA-nak — köztük a Városliget Zrt. és Kis-Grófo, aki elismerte, hogy a kapott összeg aránytalanul magas volt a valódi kulturális értékhez képest.',
      ${url},
      ${hash},
      '2026-05-23T10:00:00Z',
      'NKA',
      false, false, false
    )
  `;
  console.log('Beillesztve: NKA visszafizetes Telex cikk.');
  await sql.end();
}
main().catch(console.error);
