import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';
import { createHash } from 'node:crypto';
import { assertWriteTarget } from './guard';

/**
 * 2026-09-03 user kérés: 444.hu cikk (Velkey György László: legalább 155
 * milliárd Ft-os túlárazással vették a lélegeztetőgépeket) — nem volt még a
 * NewsArticle táblában (egy 24.hu testvércikk igen, de a user kifejezetten a
 * 444-es linket adta) — felvéve, és 72 órára breaking-pinnelve
 * (breakingPinnedUntil), l. lib/breaking.ts / breaking-pick.ts isActivePin().
 */
function canonicalUrl(input: string): string {
  const u = new URL(input);
  u.protocol = 'https:';
  u.hash = '';
  if (u.hostname.startsWith('www.')) u.hostname = u.hostname.slice(4);
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  u.search = '';
  return u.toString();
}
function dedupHash(canonical: string): string {
  return createHash('sha256').update(canonical).digest('hex');
}

const URL_ = 'https://444.hu/2026/09/03/velkey-szerint-szijjartoek-legalabb-155-milliard-forintos-tularazassal-vettek-lelegeztetogepeket';
const HEADLINE = 'Velkey szerint Szijjártóék legalább 155 milliárd forintos túlárazással vették a lélegeztetőgépeket';
const EXCERPT = 'Velkey György László államtitkár szerint csak hat, a lélegeztetőgép- és koronavírus-védőeszköz-beszerzésekben résztvevő cégnél összesen 15,5 milliárd forintos volt a túlárazás — a valós összeg jóval magasabb lehet. A feladatra szerződött, azóta megszűnt magyar cégek a járvány idején összesen mintegy 86 milliárd forint árbevételt és körülbelül 21 milliárd forint osztalékot realizáltak.';

async function main() {
  assertWriteTarget('add-lelegeztetogep-tularazas-2026-09-03');
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const [source] = await conn<{ id: string }[]>`SELECT id FROM "Source" WHERE slug = '444'`;
  if (!source) { console.error('Nincs "444" slug-ú Source sor.'); process.exit(1); }

  const canonical = canonicalUrl(URL_);
  const hash = dedupHash(canonical);

  const existing = await conn<{ id: string }[]>`SELECT id FROM "NewsArticle" WHERE "sourceUrlHash" = ${hash}`;
  let articleId: string;
  if (existing.length > 0) {
    articleId = existing[0]!.id;
    console.log(`Már létezik — [${articleId}], csak pinnelem.`);
  } else {
    const [row] = await conn<{ id: string }[]>`
      INSERT INTO "NewsArticle" ("sourceId", headline, excerpt, "sourceUrl", "sourceUrlHash", "publishedAt", tag, "isBreakingCandidate")
      VALUES (${source.id}, ${HEADLINE}, ${EXCERPT}, ${canonical}, ${hash}, now(), 'Belföld', true)
      RETURNING id
    `;
    articleId = row!.id;
    console.log(`✅ Felvéve — [${articleId}]`);
  }

  await conn`
    UPDATE "NewsArticle" SET "breakingPinnedUntil" = now() + interval '72 hours' WHERE id = ${articleId}
  `;
  console.log('✅ 72 órára breaking-pinnelve.');

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
