import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const res = await sql`
    update "NewsArticle"
    set
      headline = 'Kiadó a Rose Dor — heti 200 millióért bárki kibérelheti a Mészáros Lőrincék által használt luxusjachtot',
      featured = true,
      "publishedAt" = '2026-06-24T10:00:00Z'
    where "sourceUrl" = 'https://atlatszo.hu/kozugy/2026/06/04/kiado-lett-a-rose-dor-heti-200-millioert-barki-kiberelheti-a-meszarosek-altal-hasznalt-luxusjachtot'
    returning id, headline, featured, "publishedAt"
  `;
  if (res[0]) {
    console.log('Frissítve:', res[0].headline);
    console.log('featured:', res[0].featured, '| publishedAt:', res[0].publishedAt);
  } else {
    console.log('Nem találtam a cikket.');
  }
  await sql.end();
}
main().catch(console.error);
