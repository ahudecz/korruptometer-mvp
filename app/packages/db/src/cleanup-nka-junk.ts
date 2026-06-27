import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../apps/web/.env.local') });
loadEnv({ path: resolve(__dirname, '../../../apps/web/.env') });
import postgres from 'postgres';

// NKA-taggel vannak de semmi közük az NKA-botrányhoz
const JUNK_PATTERNS = [
  '%kisfiút felrúgó karateedzőt%',
  '%komáromi akkugyár%',
  '%TV2 Híradó munkatársait%',
  '%Demján Sándor Tőkeprogram%',
  '%Kutya Pártnak ebben a parlamentben%',
  '%Kerekes Viktória%',
  '%Már nem tartom magam újságírónak%',
  '%letelepedési kötvényes bolgár üzletasszonnyal%',
  '%Kustánczi Norbert%',
  '%Mediaworksnél%',
  '%Mediaworks megyei%',
  '%Csoportos létszámcsökkentést%',
  '%Balásy Gyulától személyes helytállást%',
  '%Papp Dániel%MTVA%',
  '%MTVA%vezérigazgatója%',
  '%magángéppel repült%Gulyás%',
  '%Gulyás Gergely%magángép%',
  '%Népszava napilap megszűnése%',
  '%sonkatállal boldog húsvétot%',
  '%TEF-igazgatót%',
];

// Tarr visszavon* cikkekből megtartjuk a legjobb 2 forrást
const TARR_KEEP_SOURCES = ['telex', '444'];

async function main() {
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  let totalDeleted = 0;

  // 1. Nyilvánvalóan ide nem tartozó cikkek
  for (const pattern of JUNK_PATTERNS) {
    const check = await conn.unsafe(
      `SELECT id, headline FROM "NewsArticle" WHERE tag ILIKE 'NKA' AND headline ILIKE $1`,
      [pattern],
    );
    if (check.length === 0) continue;
    for (const r of check) console.log(`  Törlés (junk): ${(r.headline as string)?.slice(0, 80)}`);
    await conn.unsafe(`DELETE FROM "NewsArticle" WHERE tag ILIKE 'NKA' AND headline ILIKE $1`, [pattern]);
    totalDeleted += check.length;
  }

  // 2. Tarr visszavon* duplikációk — csak Telex + 444 marad
  const tarrRows = await conn.unsafe(`
    SELECT na.id, na.headline, na."sourceUrl", s.name as source
    FROM "NewsArticle" na
    LEFT JOIN "Source" s ON s.id = na."sourceId"
    WHERE na.tag ILIKE 'NKA'
      AND (na.headline ILIKE '%Tarr Zolt%visszavon%' OR na.headline ILIKE '%Tarr Zolt%visszavonta%')
    ORDER BY na."publishedAt" DESC
  `);

  console.log(`\nTarr cikkek összesen: ${tarrRows.length}`);
  for (const r of tarrRows as any[]) {
    const src = (r.source as string ?? '').toLowerCase();
    const keep = TARR_KEEP_SOURCES.some(k => src.includes(k));
    console.log(`  ${keep ? '✓ MEGTART' : '✗ TÖRLÉS'} [${r.source}] ${(r.headline as string)?.slice(0, 60)}`);
    if (!keep) {
      await conn.unsafe(`DELETE FROM "NewsArticle" WHERE id = $1`, [r.id]);
      totalDeleted++;
    }
  }

  const [{ n } = { n: 0 }] = await conn<{ n: number }[]>`SELECT count(*)::int as n FROM "NewsArticle"`;
  console.log(`\n✅ Törölve összesen: ${totalDeleted} cikk · Maradó cikkek: ${n}`);
  await conn.end();
}
main().catch(e => { console.error(e); process.exit(1); });
