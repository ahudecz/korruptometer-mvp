import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
import postgres from 'postgres';
import { createHash } from 'node:crypto';
import { assertWriteTarget } from './guard';

/**
 * 2026-11-13 user kérés: 444.hu cikk — az NVVH közzétette a Seszták Miklós
 * elrejtett készpénzének megtalálásáról készült képeket.
 *  1. NewsArticle-sor (nem volt még a táblában) + breaking-pin az egész
 *     hétvégére: 2026-11-16 (hétfő) 08:00 budapesti idő = 07:00 UTC.
 *  2. AssetRecovery-sor a Volánbusz-ügyhöz. Összeg: a hatóság közlése szerinti
 *     „több mint 6 milliárd forint" alsó határa (6 000 000 000 Ft) — a deviza-
 *     részek forintosítását a forrás nem közli tételesen, ezért nem számolunk
 *     saját árfolyammal (l. feedback-no-invented-data).
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

const URL_ = 'https://444.hu/2026/11/13/itt-van-az-ev-legerosebb-kontentje-az-nvvh-kozzetette-a-sesztak-miklos-eldugott-keszpenzmilliardjainak-megtalalasarol-keszult-kepeket';
const HEADLINE = 'Itt van az év legerősebb kontentje: az NVVH közzétette a Seszták Miklós eldugott készpénzmilliárdjainak megtalálásáról készült képeket';
const EXCERPT = 'A nyomozók november 12-én és 13-án Budapesten, valamint Pest, Békés és Nógrád megyében – erdőben elásva, raktárakban, lakóingatlanokban és egy széfben – 5 071 632 000 forintot, 2 658 350 eurót és 1 257 100 amerikai dollárt találtak, összesen több mint 6 milliárd forintot. A hatóság szerint a teljes összeget befizették a Magyar Államkincstárba.';
const PUBLISHED_AT = '2026-11-13T20:34:00Z'; // 21:34 budapesti idő (444)
const PIN_UNTIL = '2026-11-16T07:00:00Z'; // hétfő 08:00 budapesti idő

const RECOVERY = {
  caseId: 'volánbusz',
  caseLabel: 'Volánbusz-ügy · Seszták Miklós elrejtett készpénze',
  description: 'A nyomozók 2026. november 12–13-án Budapesten, valamint Pest, Békés és Nógrád megyében Seszták Miklóshoz köthető, elrejtett készpénzt találtak: 5 071 632 000 forintot, 2 658 350 eurót és 1 257 100 amerikai dollárt, a hatóság közlése szerint összesen több mint 6 milliárd forintot. A teljes összeget befizették a Magyar Államkincstárba.',
  amountFt: 6_000_000_000n,
  recoveredAt: '2026-11-13T00:00:00Z',
  sourceName: '444',
};

async function main() {
  assertWriteTarget('add-sesztak-keszpenz-2026-11-13');
  const conn = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

  const [source] = await conn<{ id: string }[]>`SELECT id FROM "Source" WHERE slug = '444'`;
  if (!source) { console.error('Nincs "444" slug-ú Source sor.'); process.exit(1); }

  const canonical = canonicalUrl(URL_);
  const hash = dedupHash(canonical);

  const existing = await conn<{ id: string }[]>`SELECT id FROM "NewsArticle" WHERE "sourceUrlHash" = ${hash}`;
  let articleId: string;
  if (existing.length > 0) {
    articleId = existing[0]!.id;
    console.log(`Cikk már létezik — [${articleId}], csak pinnelem.`);
  } else {
    const [row] = await conn<{ id: string }[]>`
      INSERT INTO "NewsArticle" ("sourceId", headline, excerpt, "sourceUrl", "sourceUrlHash", "publishedAt", tag, "isBreakingCandidate")
      VALUES (${source.id}, ${HEADLINE}, ${EXCERPT}, ${canonical}, ${hash}, ${PUBLISHED_AT}, 'Vagyonvisszaszerzés', true)
      RETURNING id
    `;
    articleId = row!.id;
    console.log(`✅ Cikk felvéve — [${articleId}]`);
  }

  await conn`UPDATE "NewsArticle" SET "breakingPinnedUntil" = ${PIN_UNTIL} WHERE id = ${articleId}`;
  console.log(`✅ Breaking-pin: ${PIN_UNTIL}-ig.`);

  const dup = await conn<{ id: string }[]>`
    SELECT id FROM "AssetRecovery" WHERE "caseId" = ${RECOVERY.caseId} AND "sourceUrl" = ${canonical}
  `;
  if (dup.length > 0) {
    console.log(`AssetRecovery már létezik — [${dup[0]!.id}], kihagyva.`);
  } else {
    const [r] = await conn<{ id: string }[]>`
      INSERT INTO "AssetRecovery" ("caseId", "caseLabel", description, "amountFt", "recoveredAt", "sourceUrl", "sourceName")
      VALUES (${RECOVERY.caseId}, ${RECOVERY.caseLabel}, ${RECOVERY.description}, ${RECOVERY.amountFt.toString()}, ${RECOVERY.recoveredAt}, ${canonical}, ${RECOVERY.sourceName})
      RETURNING id
    `;
    console.log(`✅ AssetRecovery felvéve — [${r!.id}]`);
  }

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
