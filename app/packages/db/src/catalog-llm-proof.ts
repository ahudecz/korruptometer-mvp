/**
 * Case Catalog — LLM proof-run (quality probe before scaling).
 *
 * Demonstrates what the LLM layer adds on top of the deterministic bootstrap,
 * against the three problems raised:
 *   #2 case name + synopsis  — names/describes 3 real clusters.
 *   #3 damage                — reasons an alleged-damage figure from the text
 *                              (vs. the regex "largest number mentioned").
 *   #1 repetition            — re-groups a prolific person's fragmented rows
 *                              into a handful of NAMED matters.
 *
 * ~4 Haiku calls total. Read-only except it writes the generated name/synopsis
 * into the 3 demo investigations' `summary` so you can see them in the browser.
 *
 * Usage: pnpm --filter @korr/db tsx src/catalog-llm-proof.ts
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
const sql = postgres(DB_URL, { prepare: false, max: 1 });
const ai = new Anthropic({ apiKey: API_KEY });

const mrd = (huf: number | null) =>
  huf == null ? 'n/a' : `${(Number(huf) / 1e9).toFixed(1)} Mrd Ft`;

async function toolCall<T>(userMsg: string, tool: Anthropic.Tool, maxTokens = 1500): Promise<T> {
  const res = await ai.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: userMsg }],
  });
  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') throw new Error('no tool_use in response');
  return block.input as T;
}

const NAME_TOOL: Anthropic.Tool = {
  name: 'describe_case',
  description:
    'Produce a corruption case file from a cluster of Hungarian news headlines about the same suspect and institution.',
  input_schema: {
    type: 'object',
    properties: {
      caseName: { type: 'string', description: 'Rövid, beszédes magyar ügynév (max 8 szó), pl. "MNB-alapítványok – eltűnt közpénz".' },
      synopsis: { type: 'string', description: '2-3 mondatos magyar összefoglaló: mi a gyanú, ki, mennyi, hol tart az eljárás.' },
      allegedDamageHuf: { type: 'number', description: 'Legjobb egyetlen becslés a vélelmezett kárra forintban (0 ha nem megállapítható). NE a szövegben szereplő legnagyobb számot vedd, hanem az ügyre vonatkozó kárt.' },
      damageConfidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      damageReasoning: { type: 'string', description: 'Magyarul: hogyan jutottál a kárösszeghez, melyik cikkre alapozva.' },
      offences: { type: 'array', items: { type: 'string' }, description: 'Vélelmezett bűncselekmények magyarul (pl. hűtlen kezelés, költségvetési csalás).' },
    },
    required: ['caseName', 'synopsis', 'allegedDamageHuf', 'damageConfidence', 'damageReasoning', 'offences'],
  },
};

const GROUP_TOOL: Anthropic.Tool = {
  name: 'group_into_matters',
  description:
    'Group a prolific suspect\'s mixed news headlines into distinct, separately-named corruption matters (scandals/cases).',
  input_schema: {
    type: 'object',
    properties: {
      matters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            matterName: { type: 'string', description: 'Rövid magyar ügynév.' },
            synopsis: { type: 'string', description: 'Egy mondat magyarul.' },
            articleCount: { type: 'number', description: 'Hány megadott címsor tartozik ide.' },
            allegedDamageHuf: { type: 'number', description: 'Vélelmezett kár forintban, 0 ha nem megállapítható.' },
          },
          required: ['matterName', 'synopsis', 'articleCount', 'allegedDamageHuf'],
        },
      },
    },
    required: ['matters'],
  },
};

type CaseFile = {
  caseName: string;
  synopsis: string;
  allegedDamageHuf: number;
  damageConfidence: string;
  damageReasoning: string;
  offences: string[];
};

const CLUSTERS = [
  { person: 'Matolcsy György', inst: 'Magyar Nemzeti Bank (MNB)' },
  { person: 'Lázár János', inst: 'Építési és Közlekedési Minisztérium' },
  { person: 'Rogán Antal', inst: 'Lounge Design Kft.' },
];

async function main() {
  for (const c of CLUSTERS) {
    const rows = await sql<{ id: string; title: string; amountHuf: string | null }[]>`
      SELECT i.id, k.title, k."amountHuf"
      FROM "Investigation" i
      JOIN "InvestigationArticleLink" l ON l."investigationId" = i.id
      JOIN "KMonitorArticle" k ON k."newsId" = l."articleId"::int
      WHERE i."caseKeySource" LIKE 'kmonitor_%'
        AND i."primaryPersonName" = ${c.person}
        AND i."primaryEntityName" = ${c.inst}
      ORDER BY k."pubTime" DESC
      LIMIT 60
    `;
    if (!rows.length) {
      console.log(`\n(no articles for ${c.person} / ${c.inst})`);
      continue;
    }
    const invId = rows[0]!.id;
    const list = rows
      .map((r, i) => `${i + 1}. [${mrd(r.amountHuf == null ? null : Number(r.amountHuf))}] ${r.title}`)
      .join('\n');
    const userMsg = `Suspect: ${c.person}\nInstitution: ${c.inst}\nHungarian news headlines (with the largest HUF figure the K-Monitor regex found in each — these figures are noisy, use judgement):\n\n${list}`;
    const cf = await toolCall<CaseFile>(userMsg, NAME_TOOL);

    console.log('\n' + '═'.repeat(78));
    console.log(`CLUSTER: ${c.person} / ${c.inst}  (${rows.length} cikk)`);
    console.log('─'.repeat(78));
    console.log(`  CASE NAME : ${cf.caseName}`);
    console.log(`  SYNOPSIS  : ${cf.synopsis}`);
    console.log(`  OFFENCES  : ${cf.offences.join(', ')}`);
    console.log(`  DAMAGE    : ${mrd(cf.allegedDamageHuf)}  (confidence: ${cf.damageConfidence})`);
    console.log(`  REASONING : ${cf.damageReasoning}`);

    // write name + synopsis back so it's visible in the browser
    await sql`
      UPDATE "Investigation"
      SET summary = ${`${cf.caseName} — ${cf.synopsis}`}, "updatedAt" = now()
      WHERE id = ${invId}
    `;
  }

  // ── #1 collapse demo: re-group Mészáros's fragmented rows into named matters ─
  const mrows = await sql<{ title: string; inst: string | null; amountHuf: string | null }[]>`
    SELECT DISTINCT ON (k.title) k.title, i."primaryEntityName" AS inst, k."amountHuf"
    FROM "Investigation" i
    JOIN "InvestigationArticleLink" l ON l."investigationId" = i.id
    JOIN "KMonitorArticle" k ON k."newsId" = l."articleId"::int
    WHERE i."caseKeySource" LIKE 'kmonitor_%' AND i."primaryPersonName" = 'Mészáros Lőrinc'
    ORDER BY k.title
    LIMIT 30
  `;
  const mlist = mrows
    .map((r, i) => `${i + 1}. [${r.inst ?? '—'} | ${mrd(r.amountHuf == null ? null : Number(r.amountHuf))}] ${r.title}`)
    .join('\n');
  const grouped = await toolCall<{ matters: { matterName: string; synopsis: string; articleCount: number; allegedDamageHuf: number }[] }>(
    `These ${mrows.length} Hungarian headlines all mention Mészáros Lőrinc but belong to DIFFERENT corruption matters. Group them into distinct named matters (scandals). Headlines:\n\n${mlist}`,
    GROUP_TOOL,
    4000,
  );
  if (!Array.isArray(grouped.matters)) {
    console.log('\n#1 collapse demo: model returned no matters array; skipping.');
    await sql.end();
    return;
  }

  console.log('\n' + '═'.repeat(78));
  console.log(`#1 COLLAPSE DEMO — ${mrows.length} Mészáros headlines (currently 210 separate "cases") regrouped:`);
  console.log('─'.repeat(78));
  for (const m of grouped.matters) {
    console.log(`  • ${m.matterName}  [${m.articleCount} cikk · ${mrd(m.allegedDamageHuf)}]`);
    console.log(`      ${m.synopsis}`);
  }
  console.log(`\n  → ${mrows.length} headlines collapsed into ${grouped.matters.length} named matters.`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
