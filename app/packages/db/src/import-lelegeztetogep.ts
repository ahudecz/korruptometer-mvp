import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const conn = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

function hash(url: string) {
  return createHash('sha256').update(url).digest('hex');
}

const SOURCE_SLUGS: Record<string, string> = {
  'hvg.hu': 'hvg',
};

const ARTICLES = [
  {
    headline: 'Takács Péter: mindenki tudja rólam, hogy csóró vagyok, nincs otthon 8 milliárdom',
    excerpt: 'Takács Péter volt belügyminiszter-helyettes megszólalt a lélegeztetőgép-botrány kapcsán: tagadja a vagyongyarapodást, és azt állítja, hogy semmilyen hasznot nem szerzett az ügyletből.',
    sourceUrl: 'https://hvg.hu/itthon/20260614_takacs-peter-mindenki-tudja-rolam-hogy-csoro-vagyok-nincs-otthon-8-milliardom',
    publishedAt: new Date('2026-06-14'),
    sourceDomain: 'hvg.hu',
    tag: 'lelegeztetogep',
    featured: true,
  },
  {
    headline: 'A lélegeztetőgép-bizniszben érdekelt vállalat anyacégét is felszámolják',
    excerpt: 'A lélegeztetőgép-ügyletből profitáló vállalat anyacégét 2022 végén felszámolják — az érintett cégkör tőkéje így eltűnik, mielőtt bármilyen vizsgálat lezárulhatna.',
    sourceUrl: 'https://hvg.hu/kkv/20221221_A_lelegeztetogepbizniszben_erdekelt_vallalat_anyaceget_is_felszamoljak',
    publishedAt: new Date('2022-12-21'),
    sourceDomain: 'hvg.hu',
    tag: 'lelegeztetogep',
    featured: false,
  },
  {
    headline: 'Megsemmisítette a Külügyminisztérium az iratokat a lélegeztetőgép-bizniszből',
    excerpt: 'A Külügyminisztérium megsemmisítette a lélegeztetőgép-vásárlással kapcsolatos iratokat — a Transparency International feljelentést tett.',
    sourceUrl: 'https://hvg.hu/itthon/20230522_lelegeztetogep_biznisz_Kulugyminiszterium_Transparency_iratmegsemmisites',
    publishedAt: new Date('2023-05-22'),
    sourceDomain: 'hvg.hu',
    tag: 'lelegeztetogep',
    featured: true,
  },
  {
    headline: 'Lélegeztetőgépekre írt ki közbeszerzést a honvédség',
    excerpt: 'A honvédség 2023-ban közbeszerzést írt ki lélegeztetőgépekre — miközben az állam raktáraiban ezrével porosodnak az évekkel korábban háromszoros áron vásárolt, használhatatlan gépek.',
    sourceUrl: 'https://hvg.hu/itthon/20230926_Lelegeztetogepekre_irt_ki_kozbeszerzest_a_honvedseg',
    publishedAt: new Date('2023-09-26'),
    sourceDomain: 'hvg.hu',
    tag: 'lelegeztetogep',
    featured: false,
  },
  {
    headline: 'Hiányzó adatok, hiányos mérleg — TMT Technics Kft. és a lélegeztetőgépek',
    excerpt: 'A lélegeztetőgép-bizniszben kulcsszerepet játszó TMT Technics Kft. mérlegéből alapvető adatok hiányoznak — derítette fel a HVG 2024-ben.',
    sourceUrl: 'https://hvg.hu/kkv/20240118_lelegeztetogepek_TMT_Technics_Kft_hianyzo_adatok_merleg',
    publishedAt: new Date('2024-01-18'),
    sourceDomain: 'hvg.hu',
    tag: 'lelegeztetogep',
    featured: false,
  },
  {
    headline: 'Lélegeztetőgépek beüzemelése, túlvásárlás, NER-biznisz — felpumpalták az árakat',
    excerpt: 'A HVG 360 2021-es összefoglalója részletesen bemutatja, hogyan pumpalták fel a lélegeztetőgépek árát, miért nem üzemeltek be a gépek, és kik kerestek rajtuk milliárdokat.',
    sourceUrl: 'https://hvg.hu/360/202130__lelegeztetogepek_beuzemelese__tulvasarlas__nerbiznisz__felpumpaltak',
    publishedAt: new Date('2021-07-30'),
    sourceDomain: 'hvg.hu',
    tag: 'lelegeztetogep',
    featured: false,
  },
];

async function main() {
  for (const art of ARTICLES) {
    const urlHash = hash(art.sourceUrl);

    const existing = await db
      .select({ id: schema.newsArticles.id })
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.sourceUrlHash, urlHash));

    if (existing.length > 0) {
      console.log(`SKIP: ${art.headline}`);
      continue;
    }

    const slug = SOURCE_SLUGS[art.sourceDomain];
    let sourceId: number | null = null;

    if (slug) {
      const rows = await db
        .select({ id: schema.sources.id })
        .from(schema.sources)
        .where(eq(schema.sources.slug, slug));
      sourceId = rows[0]?.id ?? null;
    }

    await db.insert(schema.newsArticles).values({
      headline: art.headline,
      excerpt: art.excerpt,
      sourceUrl: art.sourceUrl,
      sourceUrlHash: urlHash,
      publishedAt: art.publishedAt,
      tag: art.tag,
      featured: art.featured,
      sourceId,
    });

    console.log(`OK: ${art.headline}`);
  }

  await conn.end();
}

main().catch(console.error);
