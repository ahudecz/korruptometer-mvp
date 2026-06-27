/**
 * Case Catalog — benchmark-deviation damage estimation (engine Slice F, grounded).
 *
 * Real, cited, modeled loss — NOT a guessed headline number:
 *   1. From each case's article HEADLINES, extract (contract value, physical
 *      quantity, dimension) tuples WHERE BOTH are explicitly stated in the same
 *      headline (e.g. "20 milliárdért épít 5 kilométernyi vasutat" → 20 Mrd, 5 km,
 *      rail_km). The headline is the citation.
 *   2. Build fair-market cohorts per dimension (HUF per km/m²/MW) from ALL the
 *      observed tuples → p10/p50/p90 (Benchmark table), where n ≥ MIN_COHORT.
 *   3. Estimated loss = contractValue − quantity × benchmark_p50 (overpricing
 *      above the market median). Range uses p90..p10. Stored as DamageEstimate
 *      method='benchmark_deviation' with the inputs + headline citation.
 *
 * Cases without a (value, quantity) pair in a benchmarked dimension get NO
 * estimate — they stay honestly "kár n/a". No fabricated numbers.
 *
 * Usage: pnpm --filter @korr/db tsx src/catalog-benchmark-damage.ts
 */
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import Anthropic from '@anthropic-ai/sdk';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
const MODEL = process.env.INVESTIGATION_EXTRACTOR_MODEL ?? 'claude-haiku-4-5-20251001';
const CONCURRENCY = 6;
const MIN_COHORT = 5; // need ≥5 observations to trust a benchmark median
const sql = postgres(DB_URL, { prepare: false, max: CONCURRENCY + 2 });
const ai = new Anthropic({ apiKey: API_KEY });

const DIMS = ['road_km', 'rail_km', 'building_m2', 'energy_mw'] as const;

const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'extract_contracts',
  description:
    'From Hungarian corruption headlines, extract ONLY contracts where the SAME headline states BOTH a forint value AND a physical quantity (length in km, floor area in m², power in MW). Skip anything where the quantity is not explicit. Convert "milliárd"→×1e9, "millió"→×1e6.',
  input_schema: {
    type: 'object',
    properties: {
      contracts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            valueHuf: { type: 'number', description: 'Szerződési érték forintban.' },
            quantity: { type: 'number', description: 'A mennyiség (km / m² / MW).' },
            dimension: { type: 'string', enum: ['road_km', 'rail_km', 'building_m2', 'energy_mw'] },
            evidence: { type: 'string', description: 'A pontos címsor, amiből kivetted.' },
          },
          required: ['valueHuf', 'quantity', 'dimension', 'evidence'],
        },
      },
    },
    required: ['contracts'],
  },
};

type Contract = { valueHuf: number; quantity: number; dimension: string; evidence: string };
type CaseRow = { id: string; caseName: string | null };

const pct = (sorted: number[], p: number): number => {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx]!;
};

async function main() {
  const cases = await sql<CaseRow[]>`
    SELECT id, "caseName" FROM "Investigation"
    WHERE "caseKeySource" LIKE 'kmonitor_%' AND status='new'`;
  console.log(`scanning ${cases.length} cases for (value, quantity) headlines (concurrency ${CONCURRENCY})`);

  const caseContracts = new Map<string, Contract[]>();
  let inTok = 0, outTok = 0, done = 0, withData = 0, cursor = 0;

  async function worker() {
    while (cursor < cases.length) {
      const c = cases[cursor++]!;
      try {
        const titles = await sql<{ title: string }[]>`
          SELECT k.title FROM "InvestigationArticleLink" l
          JOIN "KMonitorArticle" k ON k."newsId"=l."articleId"::int
          WHERE l."investigationId"=${c.id} ORDER BY k."pubTime" DESC LIMIT 20`;
        if (titles.length) {
          const res = await ai.messages.create({
            model: MODEL, max_tokens: 1500, tools: [EXTRACT_TOOL],
            tool_choice: { type: 'tool', name: EXTRACT_TOOL.name },
            messages: [{ role: 'user', content: `Címsorok:\n${titles.map((t, i) => `${i + 1}. ${t.title}`).join('\n')}` }],
          });
          inTok += res.usage.input_tokens; outTok += res.usage.output_tokens;
          const b = res.content.find((x) => x.type === 'tool_use');
          if (b && b.type === 'tool_use') {
            const inp = b.input as { contracts?: Contract[] };
            const arr = Array.isArray(inp.contracts) ? inp.contracts : [];
            const valid = arr.filter(
              (x) => x.valueHuf > 0 && x.quantity > 0 && DIMS.includes(x.dimension as typeof DIMS[number]),
            );
            if (valid.length) { caseContracts.set(c.id, valid); withData++; }
          }
        }
      } catch (e) {
        console.error(`  ${c.id}: ${(e as Error).message}`);
      }
      if (++done % 100 === 0 || done === cases.length) {
        const cost = (inTok / 1e6) + (outTok / 1e6) * 5;
        console.log(`  ${done}/${cases.length} · ${withData} with contracts · ~$${cost.toFixed(2)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // build cohorts (HUF per unit) per dimension
  const obs = new Map<string, number[]>();
  for (const cs of caseContracts.values())
    for (const c of cs) (obs.get(c.dimension) ?? obs.set(c.dimension, []).get(c.dimension)!).push(c.valueHuf / c.quantity);
  const cohort = new Map<string, { p10: number; p50: number; p90: number; n: number }>();
  console.log('\nCohorts (HUF per unit):');
  for (const [dim, arr] of obs) {
    arr.sort((a, b) => a - b);
    const c = { p10: pct(arr, 10), p50: pct(arr, 50), p90: pct(arr, 90), n: arr.length };
    if (c.n >= MIN_COHORT) {
      cohort.set(dim, c);
      const hash = createHash('sha256').update(`${dim}|kmonitor_titles`).digest('hex');
      await sql`
        INSERT INTO "Benchmark" ("cohortHash",dimension,"cohortSpec",p10,p50,p90,n,"memberRecordIds")
        VALUES (${hash}, ${dim}, ${sql.json({ unit: dim, source: 'kmonitor_titles' })}, ${c.p10}, ${c.p50}, ${c.p90}, ${c.n}, ${sql`'{}'::uuid[]`})
        ON CONFLICT ("cohortHash") DO UPDATE SET p10=EXCLUDED.p10,p50=EXCLUDED.p50,p90=EXCLUDED.p90,n=EXCLUDED.n,"computedAt"=now()`;
    }
    console.log(`  ${dim}: n=${c.n} p50=${(c.p50 / 1e9).toFixed(2)} Mrd/unit${c.n >= MIN_COHORT ? '' : ' (too few, skipped)'}`);
  }

  // estimate overpricing loss per case
  let estimated = 0;
  for (const [caseId, contracts] of caseContracts) {
    let low = 0, high = 0; const comps: Record<string, unknown>[] = [];
    for (const k of contracts) {
      const co = cohort.get(k.dimension);
      if (!co) continue;
      const lossLow = Math.max(0, k.valueHuf - k.quantity * co.p90);
      const lossHigh = Math.max(0, k.valueHuf - k.quantity * co.p10);
      if (lossHigh <= 0) continue;
      low += lossLow; high += lossHigh;
      comps.push({ mechanism: 'overpricing', lowHuf: Math.round(lossLow), highHuf: Math.round(lossHigh), method: 'benchmark_deviation', inputs: { contractValueHuf: k.valueHuf, quantity: k.quantity, dimension: k.dimension, benchmarkP50PerUnit: Math.round(co.p50), cohortN: co.n }, formula: 'kár = szerződési érték − mennyiség × piaci medián egységár', citation: k.evidence, notes: 'Túlárazás-becslés a megfigyelt egységárak mediánjához képest.' });
    }
    if (high <= 0 || !comps.length) continue;
    await sql`
      INSERT INTO "DamageEstimate" ("investigationId","totalLowHuf","totalHighHuf",confidence,components,"inputsHash")
      VALUES (${caseId}, ${Math.round(low)}, ${Math.round(high)}, 'medium', ${sql.json(comps as Parameters<typeof sql.json>[0])}, ${createHash('sha256').update(caseId + ':bench').digest('hex')})
      ON CONFLICT ("investigationId") DO UPDATE SET "totalLowHuf"=EXCLUDED."totalLowHuf","totalHighHuf"=EXCLUDED."totalHighHuf",confidence=EXCLUDED.confidence,components=EXCLUDED.components,"computedAt"=now()`;
    estimated++;
  }
  console.log(`\ndone. ${withData} cases had value+quantity headlines; ${estimated} got a benchmark overpricing estimate. Rest stay 'kár n/a'.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
