/**
 * Case Catalog — LLM naming pass over the multi-article bootstrap cases.
 *
 * Singletons are named deterministically (caseName = their one headline, done
 * in SQL). This script handles cases with >1 article: one focused Haiku call
 * each -> { caseName, synopsis, allegedDamageHuf, confidence, reasoning,
 * offences }, written to Investigation.caseName + summary, and (when a positive
 * figure is returned) into DamageEstimate, replacing the noisy regex estimate.
 *
 * Resumable: only processes cases whose caseName IS NULL. Concurrency-limited.
 *
 * Usage: pnpm --filter @korr/db tsx src/catalog-llm-name.ts
 */
import { resolve } from 'node:path';
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

const mrd = (huf: number | null) => (huf == null ? 'n/a' : `${(huf / 1e9).toFixed(1)} Mrd`);

const NAME_TOOL: Anthropic.Tool = {
  name: 'describe_case',
  description:
    'Produce a corruption case file from a cluster of Hungarian news headlines about the same suspect and institution.',
  input_schema: {
    type: 'object',
    properties: {
      caseName: { type: 'string', description: 'Rövid, beszédes magyar ügynév (max 8 szó).' },
      synopsis: { type: 'string', description: '2-3 mondatos magyar összefoglaló: mi a gyanú, ki, mennyi, hol tart az eljárás.' },
      allegedDamageHuf: { type: 'number', description: 'Legjobb egyetlen becslés a vélelmezett kárra forintban (0 ha nem megállapítható). NE a legnagyobb említett számot vedd, hanem az ügyre vonatkozó kárt.' },
      damageConfidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      damageReasoning: { type: 'string', description: 'Magyarul: hogyan jutottál a kárösszeghez.' },
      offences: { type: 'array', items: { type: 'string' }, description: 'Vélelmezett bűncselekmények magyarul.' },
    },
    required: ['caseName', 'synopsis', 'allegedDamageHuf', 'damageConfidence', 'damageReasoning', 'offences'],
  },
};

type CaseFile = {
  caseName: string;
  synopsis: string;
  allegedDamageHuf: number;
  damageConfidence: 'low' | 'medium' | 'high';
  damageReasoning: string;
  offences: string[];
};

let inTok = 0;
let outTok = 0;

async function nameOne(c: {
  id: string;
  person: string | null;
  inst: string | null;
}): Promise<void> {
  const arts = await sql<{ title: string; amountHuf: string | null; newsId: number }[]>`
    SELECT k.title, k."amountHuf", k."newsId"
    FROM "InvestigationArticleLink" l
    JOIN "KMonitorArticle" k ON k."newsId" = l."articleId"::int
    WHERE l."investigationId" = ${c.id}
    ORDER BY k."pubTime" DESC
    LIMIT 60
  `;
  if (!arts.length) return;
  const list = arts
    .map((r, i) => `${i + 1}. [${mrd(r.amountHuf == null ? null : Number(r.amountHuf))}] ${r.title}`)
    .join('\n');
  const userMsg = `Suspect: ${c.person ?? '—'}\nInstitution: ${c.inst ?? '—'}\nHungarian news headlines (with the largest HUF figure K-Monitor's regex found in each — noisy, use judgement):\n\n${list}`;

  const res = await ai.messages.create({
    model: MODEL,
    max_tokens: 1200,
    tools: [NAME_TOOL],
    tool_choice: { type: 'tool', name: NAME_TOOL.name },
    messages: [{ role: 'user', content: userMsg }],
  });
  inTok += res.usage.input_tokens;
  outTok += res.usage.output_tokens;
  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return;
  const cf = block.input as CaseFile;

  // Naming only sets the title + synopsis. Damage is owned exclusively by the
  // tiered passes (TED procurement → alleged → rough), each of which sets a
  // basis; writing damage here produced untagged (null-basis) estimates.
  await sql`
    UPDATE "Investigation"
    SET "caseName" = ${cf.caseName}, summary = ${cf.synopsis}, "updatedAt" = now()
    WHERE id = ${c.id}
  `;
}

async function main() {
  const cases = await sql<{ id: string; person: string | null; inst: string | null }[]>`
    SELECT id, "primaryPersonName" AS person, "primaryEntityName" AS inst
    FROM "Investigation"
    WHERE "caseKeySource" LIKE 'kmonitor_%' AND "articleCount" > 1 AND "caseName" IS NULL
    ORDER BY "articleCount" DESC
  `;
  console.log(`naming ${cases.length} multi-article cases (concurrency ${CONCURRENCY})`);

  let done = 0;
  let failed = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < cases.length) {
      const c = cases[cursor++]!;
      try {
        await nameOne(c);
      } catch (e) {
        failed++;
        console.error(`  fail ${c.id}: ${(e as Error).message}`);
      }
      done++;
      if (done % 25 === 0 || done === cases.length) {
        const cost = (inTok / 1e6) * 1.0 + (outTok / 1e6) * 5.0; // Haiku 4.5 USD/Mtok
        console.log(`  ${done}/${cases.length} (fail ${failed}) · ~$${cost.toFixed(3)} (${inTok} in / ${outTok} out)`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`done: ${done - failed} named, ${failed} failed`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
