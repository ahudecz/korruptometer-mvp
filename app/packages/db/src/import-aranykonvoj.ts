import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(conn, { schema });

function hash(url: string) {
  return createHash('sha256').update(url).digest('hex');
}

const SOURCE_SLUGS: Record<string, string> = {
  'telex.hu': 'telex',
  '444.hu': '444',
  '24.hu': '24hu',
};

const ARTICLES = [
  {
    headline: 'Orbán döntött arról, hogy le kell csapni az ukrán aranykonvojra — még a rajtaütés időpontja is a kormányzattól jött',
    excerpt: 'A Telex rekonstrukciója szerint az aranykonvoj megállítása Orbán Viktor személyes döntése volt. A Miniszterelnöki Kabinetiroda adta le az utasítást a TEK-nek. Az osztrák hatóságok nem találtak szabálytalanságot — a pénzmosás-eljárás politikai ürügyként szolgált.',
    sourceUrl: 'https://telex.hu/belfold/2026/06/03/aranykonvoj-ukrajna-nav-titkosszolgalat-orban-kormany-tek',
    publishedAt: new Date('2026-06-03'),
    sourceDomain: 'telex.hu',
    tag: 'aranykonvoj',
    featured: true,
  },
  {
    headline: 'NAV belső jelentés: törvénysértően járt el a Legfőbb Ügyészség az aranykonvoj-ügyben',
    excerpt: 'Egy belső NAV-jelentés szerint a pénzmosás-eljárás szakmailag hibás és jogszerűtlen volt. Az Alkotmányvédelmi Hivatal megerősítette: a döntés kormányzati parancsból eredt. A főügyész lemondott.',
    sourceUrl: 'https://444.hu/2026/06/14/egy-nav-os-belso-jelentes-szerint-torvenysertoen-jarhatott-el-a-legfobb-ugyeszseg-az-aranykonvoj-ugyben',
    publishedAt: new Date('2026-06-14'),
    sourceDomain: '444.hu',
    tag: 'aranykonvoj',
    featured: true,
  },
  {
    headline: 'Kommandósok, ismeretlen injekció, jogellenes fogva tartás — így bántak az ukrán pénzszállítókkal',
    excerpt: 'TEK-kommandósok az M0-son állítottak meg egy ukrán Oschadbank-szállítmányt. Az egyik szállítmányozó ismeretlen injekciót kapott fogva tartása alatt, amelytől életveszélyes állapotba került — két orvosi vizsgálat igazolta az idegen anyag bejuttatását.',
    sourceUrl: 'https://telex.hu/belfold/2026/04/02/ukran-penzszallitok-ugyvedek-oscsadbank',
    publishedAt: new Date('2026-04-02'),
    sourceDomain: 'telex.hu',
    tag: 'aranykonvoj',
    featured: true,
  },
  {
    headline: 'Sulyok Tamás büntetőjogi felelőssége is felmerül az aranykonvoj-ügyben',
    excerpt: 'Dr. Horváth Lóránt ügyvéd szerint Sulyok Tamás köztársasági elnök felelőssége jogilag rendkívül aggályos: a 2026. évi II. törvény kihirdetésével egy állami kényszerítő intézkedést nyíltan külpolitikai eszközként legitimált.',
    sourceUrl: 'https://24.hu/belfold/2026/06/11/aranykonvoj-sulyok-tamas-felelosseg/',
    publishedAt: new Date('2026-06-11'),
    sourceDomain: '24.hu',
    tag: 'aranykonvoj',
    featured: false,
  },
];

async function main() {
  // Ensure 24.hu source exists
  await db.insert(schema.sources).values({
    slug: '24hu',
    name: '24.hu',
    homepage: 'https://24.hu',
    tag: 'national' as const,
  }).onConflictDoNothing({ target: schema.sources.slug });

  for (const art of ARTICLES) {
    const urlHash = hash(art.sourceUrl);
    const existing = await db.select({ id: schema.newsArticles.id }).from(schema.newsArticles).where(eq(schema.newsArticles.sourceUrlHash, urlHash));
    if (existing.length > 0) { console.log(`SKIP: ${art.headline}`); continue; }

    const slug = SOURCE_SLUGS[art.sourceDomain];
    let sourceId: number | null = null;
    if (slug) {
      const rows = await db.select({ id: schema.sources.id }).from(schema.sources).where(eq(schema.sources.slug, slug));
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
