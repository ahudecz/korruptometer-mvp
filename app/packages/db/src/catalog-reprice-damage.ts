/**
 * Case Catalog — damage re-pricing (reprice-only, non-destructive to grouping).
 *
 * The bootstrap damage figures are the LARGEST number a regex found in the
 * article — frequently the project size, national-debt context, or a total
 * spend figure rather than the alleged corruption damage for THAT case
 * (e.g. Paks II "12 500 Mrd" is the plant cost, not the damage). This pass
 * asks the LLM, per case, for the realistic alleged damage in Mrd Ft and
 * rewrites DamageEstimate. 0 → the artifact estimate is deleted.
 *
 * Only touches DamageEstimate (totalLowHuf/totalHighHuf/basis/components).
 * Does NOT merge, change status, or touch scandalKey.
 *
 * DRY_RUN=1 prints the plan and mutates nothing.
 * Usage: DRY_RUN=1 pnpm --filter @korr/db exec tsx src/catalog-reprice-damage.ts
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
const DRY_RUN = process.env.DRY_RUN === '1';
const MODEL = process.env.INVESTIGATION_EXTRACTOR_MODEL ?? 'claude-haiku-4-5-20251001';
const THRESHOLD = BigInt(process.env.REPRICE_THRESHOLD_HUF ?? '20000000000'); // 20 Mrd
const CHUNK = 25;

const sql = postgres(DB_URL, { prepare: false, max: 4 });
const ai = new Anthropic({ apiKey: API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'reprice',
  description:
    'For each Hungarian corruption case, return the realistic ALLEGED corruption damage (kár) in BILLION forints (Mrd Ft). The given figure is the largest number a regex found in the article — often the total project cost, national budget/debt, company revenue, or a multi-year aggregate, NOT the damage of this specific case. Correct it. Use 0 if no specific damage is determinable from the case (e.g. a general-context article).',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'number', description: '1-alapú sorszám.' },
            damageMrd: { type: 'number', description: 'Reális vélelmezett kár MILLIÁRD forintban (0 ha nem megállapítható). Ne a legnagyobb említett számot.' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
          required: ['i', 'damageMrd', 'confidence'],
        },
      },
    },
    required: ['items'],
  },
};

type Row = { id: string; caseName: string | null; person: string | null; inst: string | null; summary: string | null; cur: string };

async function main() {
  const rows = await sql<Row[]>`
    SELECT i.id, i."caseName", i."primaryPersonName" AS person, i."primaryEntityName" AS inst,
           i.summary, d."totalHighHuf"::text AS cur
    FROM "DamageEstimate" d JOIN "Investigation" i ON i.id = d."investigationId"
    WHERE d."totalHighHuf" >= ${THRESHOLD.toString()} AND i.status = 'new'
    ORDER BY d."totalHighHuf" DESC
  `;
  console.log(`reprice pass on ${rows.length} cases >= ${(Number(THRESHOLD) / 1e9).toFixed(0)} Mrd (DRY_RUN=${DRY_RUN})`);

  const fixes = new Map<string, { huf: bigint; conf: string }>();
  for (let off = 0; off < rows.length; off += CHUNK) {
    const chunk = rows.slice(off, off + CHUNK);
    const list = chunk
      .map((r, j) => `${j + 1}. [jelenlegi: ${(Number(r.cur) / 1e9).toFixed(0)} Mrd] ${r.caseName ?? '—'} — ${r.person ?? '—'} — ${r.inst ?? '—'}${r.summary ? ' — ' + r.summary.slice(0, 160) : ''}`)
      .join('\n');
    let items: { i: number; damageMrd: number; confidence: string }[] = [];
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await ai.messages.create({
          model: MODEL,
          max_tokens: 2000,
          tools: [TOOL],
          tool_choice: { type: 'tool', name: TOOL.name },
          messages: [{ role: 'user', content: `ESETEK (javítsd a kárt):\n${list}` }],
        });
        const block = res.content.find((b) => b.type === 'tool_use');
        if (block && block.type === 'tool_use') {
          const inp = block.input as { items?: typeof items };
          if (Array.isArray(inp.items)) items = inp.items;
        }
        break;
      } catch (e) {
        const msg = (e as Error).message;
        if (attempt === 4 || !/50\d|429|overloaded|timeout|ECONNRESET|fetch failed/i.test(msg)) {
          console.error(`\n  chunk ${off} failed: ${msg}`);
          break;
        }
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
    for (const it of items) {
      const r = chunk[it.i - 1];
      if (!r) continue;
      const huf = BigInt(Math.max(0, Math.round((it.damageMrd ?? 0) * 1e9)));
      fixes.set(r.id, { huf, conf: it.confidence ?? 'low' });
    }
    process.stdout.write(`  ${Math.min(off + CHUNK, rows.length)}/${rows.length}\r`);
  }
  console.log('');

  let changed = 0, dropped = 0, bigBefore = 0, bigAfter = 0;
  for (const r of rows) {
    const f = fixes.get(r.id);
    if (!f) continue;
    if (BigInt(r.cur) >= 500000000000n) bigBefore++;
    if (f.huf >= 500000000000n) bigAfter++;
  }
  console.log(`fixes proposed: ${fixes.size}/${rows.length}  ·  >=500 Mrd: ${bigBefore} → ${bigAfter}`);
  // Show the biggest corrections
  const sample = rows
    .filter((r) => fixes.has(r.id))
    .map((r) => ({ r, f: fixes.get(r.id)! }))
    .sort((a, b) => Number(BigInt(a.r.cur) - a.f.huf) > Number(BigInt(b.r.cur) - b.f.huf) ? -1 : 1)
    .slice(0, 12);
  for (const { r, f } of sample) {
    console.log(`  ${(Number(r.cur) / 1e9).toFixed(0)} → ${(Number(f.huf) / 1e9).toFixed(0)} Mrd · ${(r.caseName ?? '').slice(0, 60)}`);
  }

  if (DRY_RUN) {
    console.log('\nDRY_RUN — no changes written.');
    await sql.end();
    return;
  }

  for (const [id, f] of fixes) {
    if (f.huf === 0n) {
      await sql`DELETE FROM "DamageEstimate" WHERE "investigationId" = ${id}`;
      dropped++;
      continue;
    }
    await sql`
      UPDATE "DamageEstimate"
      SET "totalLowHuf" = ${f.huf.toString()}, "totalHighHuf" = ${f.huf.toString()},
          confidence = ${f.conf}, "computedAt" = now()
      WHERE "investigationId" = ${id}`;
    changed++;
  }
  console.log(`\napplied: ${changed} repriced, ${dropped} artifact estimates dropped.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
