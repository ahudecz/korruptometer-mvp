/**
 * 003 financial-evidence layer — ALLEGED (suspected) damage from reporting.
 *
 * For cases with no procurement-grounded figure, extract the single HUF amount
 * that the reporting EXPLICITLY characterizes as the suspected damage — money
 * allegedly stolen / missing / embezzled / defrauded / overpaid in THIS case —
 * with the exact source headline as the citation. This is a SOURCED suspicion
 * (basis='alleged_reported', confidence='low'), NOT a fabricated number: the
 * figure must be the one the source ties to the loss, never merely the biggest
 * number nearby, a company's value, or an unrelated contract sum. If no such
 * amount is stated → no figure (stays "nem megállapított").
 *
 * Usage: pnpm --filter @korr/db tsx src/catalog-alleged-damage.ts
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
const sql = postgres(DB_URL, { prepare: false, max: CONCURRENCY + 2 });
const ai = new Anthropic({ apiKey: API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'extract_alleged_damage',
  description:
    'Find the SINGLE HUF amount that the Hungarian reporting explicitly describes as the SUSPECTED DAMAGE of THIS corruption case — public money allegedly stolen, embezzled, missing ("eltűnt"), lost to fraud, or overpaid. It must be the amount tied to the loss/harm. Do NOT return merely the largest number, a company revenue/value, or a contract value unless the contract itself is the alleged fraud. allegedDamageHuf=0 if no such amount is clearly stated.',
  input_schema: {
    type: 'object',
    properties: {
      allegedDamageHuf: { type: 'number', description: 'A vélelmezett kár forintban (milliárd→1e9, millió→1e6). 0 ha nincs egyértelmű kárösszeg.' },
      evidenceIndex: { type: 'number', description: 'Melyik címsorból származik (1-alapú). 0 ha allegedDamageHuf=0.' },
      reasoning: { type: 'string', description: 'Rövid magyar indoklás: miért ez a vélelmezett kár.' },
    },
    required: ['allegedDamageHuf', 'evidenceIndex', 'reasoning'],
  },
};

type CaseRow = { id: string; caseName: string | null };

async function main() {
  const cases = await sql<CaseRow[]>`
    SELECT i.id, i."caseName" FROM "Investigation" i
    WHERE i."caseKeySource" LIKE 'kmonitor_%' AND i.status='new'
      AND NOT EXISTS (SELECT 1 FROM "DamageEstimate" d WHERE d."investigationId"=i.id)`;
  console.log(`scanning ${cases.length} unquantified cases for a SOURCED alleged amount`);

  const today = new Date().toISOString().slice(0, 10);
  let inTok = 0, outTok = 0, done = 0, withFig = 0, cursor = 0;

  async function worker() {
    while (cursor < cases.length) {
      const c = cases[cursor++]!;
      try {
        const arts = await sql<{ title: string; sourceUrl: string }[]>`
          SELECT k.title, k."sourceUrl" FROM "InvestigationArticleLink" l
          JOIN "KMonitorArticle" k ON k."newsId"=l."articleId"::int
          WHERE l."investigationId"=${c.id} AND l."articleSource"='kmonitor'
          ORDER BY k."pubTime" DESC LIMIT 20`;
        if (arts.length) {
          const res = await ai.messages.create({
            model: MODEL, max_tokens: 600, tools: [TOOL],
            tool_choice: { type: 'tool', name: TOOL.name },
            messages: [{ role: 'user', content: `Ügy: ${c.caseName ?? ''}\nCímsorok:\n${arts.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}` }],
          });
          inTok += res.usage.input_tokens; outTok += res.usage.output_tokens;
          const b = res.content.find((x) => x.type === 'tool_use');
          if (b && b.type === 'tool_use') {
            const o = b.input as { allegedDamageHuf: number; evidenceIndex: number; reasoning: string };
            const amt = Math.round(o.allegedDamageHuf ?? 0);
            if (amt > 0) {
              const ev = arts[(o.evidenceIndex ?? 1) - 1] ?? arts[0]!;
              const comp = [{
                mechanism: 'other', lowHuf: String(amt), highHuf: String(amt),
                method: 'claim_consolidation',
                inputs: { formula: 'a sajtó által vélelmezett kár (gyanú, nem bizonyított)', citation: { studyId: 'sajtó', sourceUrl: ev.sourceUrl, lastVerifiedAt: today } },
                notes: `${o.reasoning?.slice(0, 160) ?? ''} — forrás: „${ev.title.slice(0, 80)}”`,
              }];
              await sql`
                INSERT INTO "DamageEstimate" ("investigationId","totalLowHuf","totalHighHuf",confidence,basis,components,"inputsHash")
                VALUES (${c.id}, ${amt}, ${amt}, 'low', 'alleged_reported',
                        ${sql.json(comp as Parameters<typeof sql.json>[0])}, ${createHash('sha256').update(c.id + ':alleged').digest('hex')})
                ON CONFLICT ("investigationId") DO NOTHING`;
              withFig++;
            }
          }
        }
      } catch (e) {
        console.error(`  ${c.id}: ${(e as Error).message}`);
      }
      if (++done % 100 === 0 || done === cases.length) {
        const cost = inTok / 1e6 + (outTok / 1e6) * 5;
        console.log(`  ${done}/${cases.length} · ${withFig} alleged figures · ~$${cost.toFixed(2)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`done. ${withFig} cases got a SOURCED alleged figure; rest stay 'nem megállapított'.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
