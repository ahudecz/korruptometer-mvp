/**
 * 003 financial-evidence layer — broad TED ingest via the search API (eForms).
 *
 * For eForms-era notices (~2023+) the search API returns awarded value
 * (total-value), winner (winner-name) AND the authority estimate
 * (estimated-value-lot) directly — no per-notice XML needed. This pulls HU
 * contract-award notices in bulk and upserts them into TedNotice, vastly
 * widening contractor coverage for case matching. (Older notices keep the
 * XML-based ingest in ted-ingest.ts.)
 *
 * Usage: pnpm --filter @korr/db tsx src/ted-ingest-search.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const sql = postgres(DB_URL, { prepare: false, max: 6 });

const TED = 'https://api.ted.europa.eu/v3/notices/search';
const FROM_DATE = '20240101'; // eForms fully populated (winner-name present) from 2024
const MAX_PAGES = 200;
const PAGE = 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function flattenNames(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.flatMap(flattenNames);
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).flatMap(flattenNames);
  if (typeof v === 'string') return [v];
  return [];
}
const toNum = (v: unknown): number | null => {
  const s = Array.isArray(v) ? v[0] : v;
  if (s == null) return null;
  const n = Number(String(s).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

type Notice = {
  'publication-number': string;
  'total-value'?: unknown; 'total-value-cur'?: unknown;
  'estimated-value-lot'?: unknown; 'estimated-value-cur-lot'?: unknown;
  'winner-name'?: unknown; 'classification-cpv'?: unknown; 'notice-title'?: unknown;
};

async function main() {
  const body = (page: number) => JSON.stringify({
    query: `buyer-country="HUN" AND notice-type="can-standard" AND publication-date>=${FROM_DATE}`,
    fields: ['publication-number', 'total-value', 'total-value-cur', 'estimated-value-lot',
      'estimated-value-cur-lot', 'winner-name', 'classification-cpv', 'notice-title'],
    limit: PAGE, page, scope: 'ALL', paginationMode: 'PAGE_NUMBER',
  });
  async function fetchPage(page: number, attempt = 0): Promise<Response> {
    const res = await fetch(TED, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body(page) });
    if (res.status === 429 && attempt < 5) { await sleep(3000 * (attempt + 1)); return fetchPage(page, attempt + 1); }
    return res;
  }

  let stored = 0, withWinner = 0, withEst = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetchPage(page);
    if (!res.ok) { console.error(`page ${page}: HTTP ${res.status}`); break; }
    await sleep(900); // throttle to stay under TED rate limit
    const j = (await res.json()) as { notices?: Notice[] };
    const ns = j.notices ?? [];
    if (!ns.length) { console.log(`page ${page}: empty, stopping`); break; }

    for (const n of ns) {
      const pn = n['publication-number'];
      if (!pn) continue;
      const awardedCur = (Array.isArray(n['total-value-cur']) ? n['total-value-cur'][0] : n['total-value-cur']) as string | undefined;
      const awarded = awardedCur === 'HUF' || !awardedCur ? toNum(n['total-value']) : null;
      // estimate: sum HUF lot estimates
      const estVals = Array.isArray(n['estimated-value-lot']) ? n['estimated-value-lot'] : [];
      const estCurs = Array.isArray(n['estimated-value-cur-lot']) ? n['estimated-value-cur-lot'] : [];
      let estimated: number | null = null;
      estVals.forEach((v, i) => {
        if ((estCurs[i] ?? 'HUF') === 'HUF') { const x = toNum(v); if (x) estimated = (estimated ?? 0) + x; }
      });
      const winners = [...new Set(flattenNames(n['winner-name']))].filter((s) => s.length > 2);
      const cpvAll = [...new Set(flattenNames(n['classification-cpv']).map((s) => String(s)))];
      const title = flattenNames(n['notice-title'])[0] ?? null;
      if (!awarded && !winners.length) continue;

      await sql`
        INSERT INTO "TedNotice"
          ("publicationNumber","noticeType","title","cpvMain","cpvAll","contractors","contractorsNorm",
           "valAwardedHuf","valEstimatedHuf","currency","canonicalUrl","raw")
        VALUES (${pn}, 'can-standard', ${title}, ${cpvAll[0] ?? null}, ${cpvAll},
                ${winners}, ${winners.map(norm)}, ${awarded}, ${estimated}, ${awardedCur ?? null},
                ${`https://ted.europa.eu/en/notice/${pn}`},
                ${sql.json({ awarded, estimated, src: 'search' })})
        ON CONFLICT ("publicationNumber") DO UPDATE
          SET "valAwardedHuf"=COALESCE("TedNotice"."valAwardedHuf", EXCLUDED."valAwardedHuf"),
              "valEstimatedHuf"=COALESCE("TedNotice"."valEstimatedHuf", EXCLUDED."valEstimatedHuf"),
              contractors=CASE WHEN cardinality(EXCLUDED.contractors)>0 THEN EXCLUDED.contractors ELSE "TedNotice".contractors END,
              "contractorsNorm"=CASE WHEN cardinality(EXCLUDED."contractorsNorm")>0 THEN EXCLUDED."contractorsNorm" ELSE "TedNotice"."contractorsNorm" END,
              title=COALESCE("TedNotice".title, EXCLUDED.title), "fetchedAt"=now()`;
      stored++;
      if (winners.length) withWinner++;
      if (estimated) withEst++;
    }
    if (page % 10 === 0) console.log(`  page ${page}: ${stored} stored · ${withWinner} w/winner · ${withEst} w/estimate`);
  }
  console.log(`done. stored ${stored} notices · ${withWinner} with winner · ${withEst} with estimate.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
