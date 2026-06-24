import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });

import { createHash } from 'node:crypto';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const url = 'https://telex.hu/belfold/2026/06/23/nka-botrany-hat-szemelyt-orizetbe-vett-a-nav-hanko-balazs-tarr-zoltan';
  const urlHash = createHash('sha256').update(url).digest('hex');

  // Ha már van, csak frissítjük a breakingOverride-ot
  const existing = await sql`select id from "NewsArticle" where "sourceUrlHash" = ${urlHash}`;
  if (existing.length > 0) {
    await sql`update "NewsArticle" set "breakingOverride" = true where "sourceUrlHash" = ${urlHash}`;
    console.log('Frissítve:', existing[0].id);
    await sql.end();
    return;
  }

  // Nincs még bent — betesszük
  const sources = await sql`select id from "Source" where slug = 'telex' limit 1`;
  const sourceId = sources[0]?.id ?? null;

  await sql`
    insert into "NewsArticle"
      (headline, excerpt, "sourceUrl", "sourceUrlHash", "publishedAt", tag, featured,
       "isBreakingCandidate", "breakingOverride", "imageUrl", "sourceId")
    values (
      'NKA-botrány: hat személyt vett őrizetbe a NAV — köztük Bús Balázs volt óbudai polgármester',
      'A NAV hat személyt vett őrizetbe az NKA-botrányban. A nyomozás 17 milliárd forintnyi pályázati pénz sikkasztására irányul — a gyanú szerint a támogatásokat Fidesz-közeli előadókhoz és szervezetekhez csatornázták az április 12-i választások előtt. Bús Balázs volt fideszes óbudai polgármester, az NKA alelnöke gyanúsítottként hallgatták ki, és részletes vallomást tett. A pénzügyőrök házkutatást tartottak a Kulturális és Innovációs Minisztériumban, valamint az NKTK-nál is.',
      ${url}, ${urlHash},
      ${new Date('2026-06-23')},
      'nka', true,
      true, true,
      'https://assets.telex.hu/images/20260623/1782230393-temp-6oesleh6gpk9dcenaad_facebook.jpg',
      ${sourceId}
    )
  `;
  console.log('Beillesztve és breaking-ként jelölve.');
  await sql.end();
}
main().catch(console.error);
