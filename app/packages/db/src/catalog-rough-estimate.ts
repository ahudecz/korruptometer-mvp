/**
 * 003 financial-evidence layer — rough order-of-magnitude estimate (weakest tier).
 *
 * For cases with no court/audit/procurement/alleged figure, an LLM reasons a
 * ROUGH order-of-magnitude of the public money implicated in the suspected
 * corruption — NOT the biggest number it sees, but the scale of the whole case.
 * Always a positive figure so every case can be ranked; stored as
 * basis='estimated_rough', confidence='low' (the weakest validity tier), with
 * the reasoning and an explicit "nem forrásolt összeg" formula. Never presented
 * as fact — the UI badges it as BECSLÉS.
 *
 * Usage: pnpm --filter @korr/db tsx src/catalog-rough-estimate.ts
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
const FLOOR = 50_000_000; // 50 M Ft minimum so every case ranks
const sql = postgres(DB_URL, { prepare: false, max: CONCURRENCY + 2 });
const ai = new Anthropic({ apiKey: API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'estimate_magnitude',
  description:
    'Estimate the ROUGH ORDER OF MAGNITUDE (not an exact figure) of public money implicated in this suspected Hungarian corruption case, based on the headlines. Reason about the scale of the WHOLE case, NOT the single biggest number mentioned. Always return a positive best-guess (e.g. 50M, 500M, 5 Mrd, 50 Mrd).',
  input_schema: {
    type: 'object',
    properties: {
      magnitudeHuf: { type: 'number', description: 'Nagyságrendi becslés forintban (mindig > 0).' },
      reasoning: { type: 'string', description: 'Rövid magyar indoklás a nagyságrendről.' },
    },
    required: ['magnitudeHuf', 'reasoning'],
  },
};

async function main() {
  const cases = await sql<{ id: string; caseName: string | null }[]>`
    SELECT i.id, i."caseName" FROM "Investigation" i
    WHERE i."caseKeySource" LIKE 'kmonitor_%' AND i.status='new'
      AND NOT EXISTS (SELECT 1 FROM "DamageEstimate" d WHERE d."investigationId"=i.id)`;
  console.log(`rough-estimating ${cases.length} cases (weakest tier, always a number)`);

  let inTok = 0, outTok = 0, done = 0, est = 0, cursor = 0;
  async function worker() {
    while (cursor < cases.length) {
      const c = cases[cursor++]!;
      let magnitude = 0, reasoning = '';
      try {
        const arts = await sql<{ title: string }[]>`
          SELECT k.title FROM "InvestigationArticleLink" l
          JOIN "KMonitorArticle" k ON k."newsId"=l."articleId"::int
          WHERE l."investigationId"=${c.id} AND l."articleSource"='kmonitor'
          ORDER BY k."pubTime" DESC LIMIT 15`;
        if (arts.length) {
          const res = await ai.messages.create({
            model: MODEL, max_tokens: 400, tools: [TOOL],
            tool_choice: { type: 'tool', name: TOOL.name },
            messages: [{ role: 'user', content: `Ügy: ${c.caseName ?? ''}\nCímsorok:\n${arts.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}` }],
          });
          inTok += res.usage.input_tokens; outTok += res.usage.output_tokens;
          const b = res.content.find((x) => x.type === 'tool_use');
          if (b && b.type === 'tool_use') {
            const o = b.input as { magnitudeHuf: number; reasoning: string };
            magnitude = Math.round(o.magnitudeHuf ?? 0);
            reasoning = o.reasoning ?? '';
          }
        }
      } catch (e) {
        console.error(`  ${c.id}: ${(e as Error).message}`);
      }
      const amt = magnitude > 0 ? magnitude : FLOOR;
      const comp = [{
        mechanism: 'other', lowHuf: String(amt), highHuf: String(amt),
        method: 'industry_estimate',
        inputs: { formula: 'nagyságrendi becslés az ügy alapján (nem forrásolt, nem bizonyított összeg)' },
        notes: reasoning.slice(0, 180) || 'Nagyságrendi becslés.',
      }];
      await sql`
        INSERT INTO "DamageEstimate" ("investigationId","totalLowHuf","totalHighHuf",confidence,basis,components,"inputsHash")
        VALUES (${c.id}, ${amt}, ${amt}, 'low', 'estimated_rough',
                ${sql.json(comp as Parameters<typeof sql.json>[0])}, ${createHash('sha256').update(c.id + ':rough').digest('hex')})
        ON CONFLICT ("investigationId") DO NOTHING`;
      est++;
      if (++done % 100 === 0 || done === cases.length) {
        const cost = inTok / 1e6 + (outTok / 1e6) * 5;
        console.log(`  ${done}/${cases.length} · ${est} estimated · ~$${cost.toFixed(2)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`done. ${est} cases got a rough BECSLÉS figure. Every case now ranks.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
