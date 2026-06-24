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

  // Upsert Atlatszo source
  let srcId: string;
  const ex = await sql`select id from "Source" where slug = 'atlatszo' limit 1`;
  if (ex[0]) {
    srcId = ex[0].id as string;
    console.log('Atlatszo forrás már létezik.');
  } else {
    const ins = await sql`
      insert into "Source" (slug, name, homepage, tag)
      values ('atlatszo', 'Atlátszó', 'https://atlatszo.hu', 'national')
      returning id
    `;
    srcId = ins[0].id as string;
    console.log('Atlatszo forrás létrehozva.');
  }

  const url = 'https://atlatszo.hu/kozugy/2026/06/04/kiado-lett-a-rose-dor-heti-200-millioert-barki-kiberelheti-a-meszarosek-altal-hasznalt-luxusjachtot';
  const hash = urlHash(url);

  const art = await sql`select id from "NewsArticle" where "sourceUrlHash" = ${hash} limit 1`;
  if (art[0]) {
    console.log('Cikk már létezik, kihagyva.');
    await sql.end();
    return;
  }

  await sql`
    insert into "NewsArticle"
      ("sourceId", headline, excerpt, "sourceUrl", "sourceUrlHash", "publishedAt", tag, featured, "breakingOverride", "isBreakingCandidate")
    values (
      ${srcId},
      'Kiadó lett a Rose Dor — heti 200 millióért bárki kibérelheti a Mészárosék által használt luxusjachtot',
      'A Mészáros-família által korábban használt Rose Dor luxusjacht mostantól bárki számára bérelhető — heti 200 millió forintért. Az Atlátszó feltárta, hogyan vált a milliárdos közpénzből épített életmód nyilvánosan elérhető luxuscikké.',
      ${url},
      ${hash},
      '2026-06-04T10:00:00Z',
      'meszaros',
      false, false, false
    )
  `;
  console.log('Beillesztve: Rose Dor Atlatszo cikk.');

  await sql.end();
}
main().catch(console.error);
