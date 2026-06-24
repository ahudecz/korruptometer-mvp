import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });

import { createHash } from 'node:crypto';
import postgres from 'postgres';

function urlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 32);
}

async function upsertSource(sql: postgres.Sql, slug: string, name: string, homepage: string, tag: string): Promise<string> {
  const existing = await sql`select id from "Source" where slug = ${slug} limit 1`;
  if (existing[0]) return existing[0].id as string;
  const inserted = await sql`
    insert into "Source" (slug, name, homepage, tag)
    values (${slug}, ${name}, ${homepage}, ${tag})
    returning id
  `;
  console.log(`Forrás létrehozva: ${name}`);
  return inserted[0].id as string;
}

async function upsertArticle(sql: postgres.Sql, {
  sourceId, headline, excerpt, sourceUrl, publishedAt, tag, breakingOverride, featured,
}: {
  sourceId: string; headline: string; excerpt: string; sourceUrl: string;
  publishedAt: Date; tag: string; breakingOverride: boolean; featured: boolean;
}) {
  const hash = urlHash(sourceUrl);
  const existing = await sql`select id from "NewsArticle" where "sourceUrlHash" = ${hash} limit 1`;
  if (existing[0]) {
    await sql`
      update "NewsArticle"
      set "breakingOverride" = ${breakingOverride}, featured = ${featured}
      where "sourceUrlHash" = ${hash}
    `;
    console.log(`Frissítve (breaking): ${headline.slice(0, 60)}`);
  } else {
    await sql`
      insert into "NewsArticle"
        ("sourceId", headline, excerpt, "sourceUrl", "sourceUrlHash", "publishedAt", tag, "breakingOverride", featured)
      values (
        ${sourceId}, ${headline}, ${excerpt}, ${sourceUrl}, ${hash},
        ${publishedAt}, ${tag}, ${breakingOverride}, ${featured}
      )
    `;
    console.log(`Beillesztve: ${headline.slice(0, 60)}`);
  }
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const telexId = await upsertSource(sql, 'telex', 'Telex', 'https://telex.hu', 'national');
  const navId   = await upsertSource(sql, 'nav-hu', 'NAV.hu', 'https://nav.gov.hu', 'agency');

  const publishedAt = new Date('2026-06-23T10:00:00Z');

  await upsertArticle(sql, {
    sourceId: telexId,
    headline: 'NKA-botrány: hat személyt vett őrizetbe a NAV — köztük Bús Balázs volt óbudai polgármester',
    excerpt: 'A NAV nyomozói 2026. június 23-án hat személyt vettek őrizetbe hűtlen kezelés bűntett megalapozott gyanúja miatt — köztük Bús Balázs volt fideszes óbudai polgármestert, az NKA alelnökét, aki részletes vallomást tett.',
    sourceUrl: 'https://telex.hu/belfold/2026/06/23/nka-botrany-hat-szemelyt-orizetbe-vett-a-nav-hanko-balazs-tarr-zoltan',
    publishedAt,
    tag: 'NKA',
    breakingOverride: true,
    featured: true,
  });

  await upsertArticle(sql, {
    sourceId: navId,
    headline: 'Áttörés az NKA-ügyben — hat személyt vett őrizetbe a NAV',
    excerpt: 'A NAV nyomozói hűtlen kezelés bűntett megalapozott gyanúja miatt hat személyt vettek őrizetbe — az NKTK és a Kulturális és Innovációs Minisztérium alkalmazottait. Az ügy több mint 17 milliárd forintot érint.',
    sourceUrl: 'https://nav.gov.hu/sajtoszoba/hirek/Attores_az_NKA-ugyben',
    publishedAt,
    tag: 'NKA',
    breakingOverride: true,
    featured: false,
  });

  await sql.end();
  console.log('Kész — NKA breaking cikkek hozzáadva.');
}
main().catch(console.error);
