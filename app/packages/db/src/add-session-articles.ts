import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });

import { createHash } from 'node:crypto';
import postgres from 'postgres';

function urlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 32);
}

async function upsertSource(
  sql: postgres.Sql,
  slug: string, name: string, homepage: string, tag: string
): Promise<string> {
  const ex = await sql`select id from "Source" where slug = ${slug} limit 1`;
  if (ex[0]) return ex[0].id as string;
  const ins = await sql`
    insert into "Source" (slug, name, homepage, tag)
    values (${slug}, ${name}, ${homepage}, ${tag})
    returning id
  `;
  console.log(`  Forrás létrehozva: ${name}`);
  return ins[0].id as string;
}

async function upsertArticle(
  sql: postgres.Sql,
  opts: {
    sourceId: string;
    headline: string;
    excerpt: string;
    sourceUrl: string;
    publishedAt: Date;
    tag: string;
    featured?: boolean;
    breakingOverride?: boolean;
    isBreakingCandidate?: boolean;
    imageUrl?: string;
  }
) {
  const hash = urlHash(opts.sourceUrl);
  const ex = await sql`select id from "NewsArticle" where "sourceUrlHash" = ${hash} limit 1`;
  if (ex[0]) {
    console.log(`  Már létezik: ${opts.headline.slice(0, 60)}`);
    return;
  }
  await sql`
    insert into "NewsArticle"
      ("sourceId", headline, excerpt, "sourceUrl", "sourceUrlHash", "publishedAt", tag,
       featured, "breakingOverride", "isBreakingCandidate")
    values (
      ${opts.sourceId}, ${opts.headline}, ${opts.excerpt}, ${opts.sourceUrl}, ${hash},
      ${opts.publishedAt}, ${opts.tag},
      ${opts.featured ?? false}, ${opts.breakingOverride ?? false}, ${opts.isBreakingCandidate ?? false}
    )
  `;
  console.log(`  Beillesztve: ${opts.headline.slice(0, 65)}`);
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  // ── Forrás upsert-ek ────────────────────────────────────────────────
  const telexId    = await upsertSource(sql, 'telex',    'Telex',    'https://telex.hu',        'national');
  const hvgId      = await upsertSource(sql, 'hvg',      'HVG',      'https://hvg.hu',           'national');
  const nepszavaId = await upsertSource(sql, 'nepszava', 'Népszava', 'https://nepszava.hu',      'national');
  const _24huId    = await upsertSource(sql, '24hu',     '24.hu',    'https://24.hu',            'national');

  // ══ PARKFENNTARTÁS cikkek ═══════════════════════════════════════════

  console.log('\n── Parkfenntartás ──');

  await upsertArticle(sql, {
    sourceId: telexId,
    headline: 'Letartóztatva: Őrsi Gergely és más politikusok — parkfenntartási kenőpénzbotrány',
    excerpt: 'A Fővárosi Törvényszék 2026. június 4-én 30 napra letartóztatta a parkfenntartási kenőpénzbotrány nyolc gyanúsítottját — köztük Őrsi Gergely (DK) II. kerületi polgármestert, Láng Zsolt (Fidesz) volt polgármestert és négy más politikust.',
    sourceUrl: 'https://telex.hu/belfold/2026/06/04/orsi-gergely-reakcio-letartoztatas',
    publishedAt: new Date('2026-06-04T12:00:00Z'),
    tag: 'parkfenntartas',
    featured: false,
  });

  await upsertArticle(sql, {
    sourceId: hvgId,
    headline: 'Bűnismétlés — gyanúsítotti letartóztatás a parkfenntartási kenőpénzbotrányban',
    excerpt: 'A HVG feltárta: a parkfenntartási kenőpénzbotrány gyanúsítottjai közül legalább egyiknek korábbi büntetett előélete van. A Fővárosi Törvényszék 30 nap előzetes letartóztatást rendelt el.',
    sourceUrl: 'https://hvg.hu/itthon/20260605_bunismetles-parkfenntartasi-kenopenzbotrany-gyanusitott-letartoztatas',
    publishedAt: new Date('2026-06-05T10:00:00Z'),
    tag: 'parkfenntartas',
    featured: false,
  });

  await upsertArticle(sql, {
    sourceId: nepszavaId,
    headline: 'Bús Balázs és az óbudai parkfenntartási korrupció',
    excerpt: 'A Népszava cikke az óbudai (III. kerületi) szálat vizsgálja a parkfenntartási botrányban — Bús Balázs neve is felmerül a milliárdos közpénzes szerződések körüli gyanúsítások kapcsán.',
    sourceUrl: 'https://nepszava.hu/3326824_bus-balazs-obuda-parkfenntartasi-korrupcio',
    publishedAt: new Date('2026-06-08T09:00:00Z'),
    tag: 'parkfenntartas',
    featured: false,
  });

  await upsertArticle(sql, {
    sourceId: telexId,
    headline: 'Pék és Karácsony Gergely neve a parkfenntartási ügyben',
    excerpt: 'A parkfenntartási botrány egyik kulcsfigurája, a „Pék" nevű közvetítő a kihallgatáson azt állítja, hogy Karácsony Gergely nevében is gyűjtött kenőpénzt — Karácsony cáfolja az állítást.',
    sourceUrl: 'https://telex.hu/belfold/2026/06/22/pek-korrupcio-karacsony-gergely-neveben-parkfenntartas',
    publishedAt: new Date('2026-06-22T08:00:00Z'),
    tag: 'parkfenntartas',
    featured: false,
  });

  await upsertArticle(sql, {
    sourceId: telexId,
    headline: 'Milliárdos szerződések az óbudai parkfenntartási botrányban — G7-feltárás',
    excerpt: 'A G7 feltárta a Pannon Park cégcsoport óbudai és más kerületi parkfenntartási szerződéseinek részleteit. A XIII. kerületben egyedül 35+ milliárd forintos szerződésállomány érintett a korrupciós ügyben.',
    sourceUrl: 'https://telex.hu/g7/vallalat/2026/06/22/parkfenntartas-obudai-korrupcios-ugy-szerzodes',
    publishedAt: new Date('2026-06-22T10:00:00Z'),
    tag: 'parkfenntartas',
    featured: false,
  });

  // ══ MANDINER cikk ════════════════════════════════════════════════════

  console.log('\n── Mandiner ──');

  await upsertArticle(sql, {
    sourceId: _24huId,
    headline: '60 embert küldtek el a Mandinertől — MCC-leépítés, Kohán Mátyás főszerkesztő',
    excerpt: 'Kohán Mátyás, a Mandiner főszerkesztője 2026. június 24-én 60 munkatársat bocsátott el. A tömeges kirúgás az MCC égisze alatt zajló propagandamédia-átszervezés részeként értékelhető — a Fidesz sajtóbirodalma konszolidációba kezdett.',
    sourceUrl: 'https://24.hu/belfold/2026/06/24/mendiber-leepites-mcc-fidesz-propaganda-kohan-matyas/',
    publishedAt: new Date('2026-06-24T12:00:00Z'),
    tag: 'KESMA',
    featured: true,
    isBreakingCandidate: true,
  });

  await sql.end();
  console.log('\nKész.');
}

main().catch(console.error);
