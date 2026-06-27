/**
 * 003 financial-evidence layer — TED procurement ingest.
 *
 * Pulls Hungarian contract-AWARD notices from TED for a set of CPV codes,
 * fetches each notice's XML, and extracts the structured facts we need:
 *   awarded value (VAL_TOTAL / PROCUREMENT_TOTAL), the authority's pre-tender
 *   ESTIMATE (VAL_ESTIMATED_TOTAL), CPV codes, title, and winning contractors
 *   (OFFICIALNAME inside <AWARD_CONTRACT>). Upserts into TedNotice.
 *
 * The old-schema (R2.0.9) TED XML is flat tags → parsed with targeted regex
 * (no XML-parser dependency). Notices in non-HUF currency keep their currency;
 * downstream overpricing only compares same-currency figures.
 *
 * Usage: pnpm --filter @korr/db tsx src/ted-ingest.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const sql = postgres(DB_URL, { prepare: false, max: 8 });

const TED = 'https://api.ted.europa.eu/v3/notices/search';
// Construction CPV families: roads, rail, buildings, energy/utilities.
const CPVS = ['45233140', '45233120', '45234100', '45210000', '45213000', '45230000'];
const MAX_PER_CPV = 400;
const FETCH_CONCURRENCY = 8;

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const m = s.replace(/\s/g, '').match(/[0-9]+/);
  return m ? Number(m[0]) : null;
};
function tag(re: RegExp, xml: string): string | undefined {
  return re.exec(xml)?.[1];
}

type Parsed = {
  title: string | null;
  cpvAll: string[];
  cpvMain: string | null;
  valAwarded: number | null;
  valEstimated: number | null;
  currency: string | null;
  contractors: string[];
  buyer: string | null;
};

function parseNotice(xml: string): Parsed {
  const cpvAll = [...xml.matchAll(/CPV_CODE\s+CODE="(\d+)"/g)].map((m) => m[1]!);
  const cpvMain = tag(/ORIGINAL_CPV\s+CODE="(\d+)"/, xml) ?? cpvAll[0] ?? null;
  // awarded: prefer PROCUREMENT_TOTAL, else the largest VAL_TOTAL
  const procTotal = /<VALUE\s+TYPE="PROCUREMENT_TOTAL"\s+CURRENCY="([A-Z]+)">([\d.]+)</.exec(xml);
  let valAwarded: number | null = null;
  let currency: string | null = null;
  if (procTotal) { currency = procTotal[1]!; valAwarded = num(procTotal[2]); }
  else {
    const totals = [...xml.matchAll(/<VAL_TOTAL\s+CURRENCY="([A-Z]+)">([\d.]+)</g)];
    if (totals.length) {
      const best = totals.map((t) => ({ c: t[1]!, v: num(t[2]) ?? 0 })).sort((a, b) => b.v - a.v)[0]!;
      currency = best.c; valAwarded = best.v;
    }
  }
  const est = /<VAL_ESTIMATED_TOTAL\s+CURRENCY="([A-Z]+)">([\d.]+)</.exec(xml);
  const valEstimated = est ? num(est[2]) : null;
  if (!currency && est) currency = est[1]!;
  // title: first <TITLE> ... text
  const titleBlock = /<TITLE>([\s\S]*?)<\/TITLE>/.exec(xml)?.[1] ?? '';
  const title = titleBlock.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
  // contractors: OFFICIALNAMEs that occur inside <AWARD_CONTRACT> blocks
  const contractors = new Set<string>();
  for (const block of xml.matchAll(/<AWARD_CONTRACT[\s\S]*?<\/AWARD_CONTRACT>/g))
    for (const m of block[0].matchAll(/<OFFICIALNAME>([^<]+)<\/OFFICIALNAME>/g))
      contractors.add(m[1]!.trim());
  // buyer: OFFICIALNAME inside the contracting body
  const cbBlock = /<ADDRESS_CONTRACTING_BODY[\s\S]*?<\/ADDRESS_CONTRACTING_BODY>/.exec(xml)?.[0] ?? '';
  const buyer = /<OFFICIALNAME>([^<]+)<\/OFFICIALNAME>/.exec(cbBlock)?.[1]?.trim() ?? null;
  return { title, cpvAll: [...new Set(cpvAll)], cpvMain, valAwarded, valEstimated, currency, contractors: [...contractors], buyer };
}

async function searchPns(cpv: string): Promise<string[]> {
  const pns: string[] = [];
  for (let page = 1; pns.length < MAX_PER_CPV && page <= 8; page++) {
    const res = await fetch(TED, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `buyer-country="HUN" AND notice-type="can-standard" AND classification-cpv="${cpv}"`,
        fields: ['publication-number'],
        limit: 100, page, scope: 'ALL', paginationMode: 'PAGE_NUMBER',
      }),
    });
    if (!res.ok) break;
    const j = (await res.json()) as { notices?: { 'publication-number': string }[] };
    const batch = (j.notices ?? []).map((n) => n['publication-number']).filter(Boolean);
    if (!batch.length) break;
    pns.push(...batch);
  }
  return [...new Set(pns)].slice(0, MAX_PER_CPV);
}

async function fetchXml(pn: string): Promise<string | null> {
  try {
    const r = await fetch(`https://ted.europa.eu/en/notice/${pn}/xml`, { signal: AbortSignal.timeout(30000) });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

async function main() {
  const allPns = new Set<string>();
  for (const cpv of CPVS) {
    const pns = await searchPns(cpv);
    pns.forEach((p) => allPns.add(p));
    console.log(`CPV ${cpv}: ${pns.length} award notices (running total ${allPns.size})`);
  }
  const pns = [...allPns];
  console.log(`fetching + parsing ${pns.length} notice XMLs...`);

  let done = 0, stored = 0, withBoth = 0, cursor = 0;
  async function worker() {
    while (cursor < pns.length) {
      const pn = pns[cursor++]!;
      const xml = await fetchXml(pn);
      done++;
      if (xml) {
        const p = parseNotice(xml);
        if (p.valAwarded || p.contractors.length) {
          await sql`
            INSERT INTO "TedNotice"
              ("publicationNumber","noticeType","title","cpvMain","cpvAll","buyerName",
               "contractors","contractorsNorm","valAwardedHuf","valEstimatedHuf","currency","canonicalUrl","raw")
            VALUES (${pn}, 'can-standard', ${p.title}, ${p.cpvMain}, ${p.cpvAll}, ${p.buyer},
                    ${p.contractors}, ${p.contractors.map(norm)},
                    ${p.currency === 'HUF' ? p.valAwarded : null},
                    ${p.currency === 'HUF' ? p.valEstimated : null},
                    ${p.currency}, ${`https://ted.europa.eu/en/notice/${pn}`},
                    ${sql.json({ valAwarded: p.valAwarded, valEstimated: p.valEstimated, currency: p.currency })})
            ON CONFLICT ("publicationNumber") DO UPDATE
              SET "valAwardedHuf"=EXCLUDED."valAwardedHuf", "valEstimatedHuf"=EXCLUDED."valEstimatedHuf",
                  contractors=EXCLUDED.contractors, "contractorsNorm"=EXCLUDED."contractorsNorm",
                  title=EXCLUDED.title, "cpvAll"=EXCLUDED."cpvAll", "fetchedAt"=now()`;
          stored++;
          if (p.valAwarded && p.valEstimated && p.currency === 'HUF') withBoth++;
        }
      }
      if (done % 50 === 0 || done === pns.length)
        console.log(`  ${done}/${pns.length} fetched · ${stored} stored · ${withBoth} with awarded+estimate`);
    }
  }
  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, () => worker()));
  console.log(`done. stored ${stored} notices, ${withBoth} have both awarded + estimate (overpricing-computable).`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
