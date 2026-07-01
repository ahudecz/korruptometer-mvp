/**
 * Case Catalog — scandalName spelling/grammar cleanup (cosmetic).
 *
 * The scandalKey pass produced a few LLM-typo'd names (e.g. "NER-milliárdok
 * rejtegzés", "...vezetkezeletes"). This normalizes scandalName for multi-case
 * scandals: fix spelling/grammar only, keep the meaning and the "X botrány /
 * X-ügy" style. scandalKey is never changed. Writes scandalName to every
 * Investigation sharing the key.
 *
 * DRY_RUN=1 prints the plan.
 * Usage: pnpm --filter @korr/db exec tsx src/catalog-fix-names.ts
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
const CHUNK = 40;

const sql = postgres(DB_URL, { prepare: false, max: 4 });
const ai = new Anthropic({ apiKey: API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'fix_names',
  description:
    'Normalise Hungarian scandal names: correct spelling and grammar ONLY, keep the same meaning and the concise "X botrány" / "X-ügy" style. Do not invent new names or change which scandal it refers to.',
  input_schema: {
    type: 'object',
    properties: {
      names: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'number' },
            name: { type: 'string', description: 'A javított, helyesírásilag korrekt ügynév.' },
          },
          required: ['i', 'name'],
        },
      },
    },
    required: ['names'],
  },
};

async function main() {
  const rows = await sql<{ key: string; name: string }[]>`
    SELECT "scandalKey" AS key, max("scandalName") AS name
    FROM "Investigation"
    WHERE "scandalKey" IS NOT NULL AND status = 'new'
    GROUP BY "scandalKey" HAVING count(*) > 1
    ORDER BY "scandalKey"
  `;
  console.log(`name cleanup on ${rows.length} multi-case scandals (DRY_RUN=${DRY_RUN})`);

  const fixed = new Map<string, string>();
  for (let off = 0; off < rows.length; off += CHUNK) {
    const chunk = rows.slice(off, off + CHUNK);
    const list = chunk.map((r, j) => `${j + 1}. ${r.name}`).join('\n');
    let names: { i: number; name: string }[] = [];
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await ai.messages.create({
          model: MODEL,
          max_tokens: 2000,
          tools: [TOOL],
          tool_choice: { type: 'tool', name: TOOL.name },
          messages: [{ role: 'user', content: `ÜGYNEVEK (javítsd a helyesírást):\n${list}` }],
        });
        const block = res.content.find((b) => b.type === 'tool_use');
        if (block && block.type === 'tool_use') {
          const inp = block.input as { names?: typeof names };
          if (Array.isArray(inp.names)) names = inp.names;
        }
        break;
      } catch (e) {
        const msg = (e as Error).message;
        if (attempt === 4 || !/50\d|429|overloaded|timeout|ECONNRESET|fetch failed/i.test(msg)) { console.error(`\n  chunk ${off} failed: ${msg}`); break; }
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
    for (const n of names) {
      const r = chunk[n.i - 1];
      if (!r) continue;
      const clean = n.name.trim();
      if (clean && clean !== r.name) fixed.set(r.key, clean);
    }
    process.stdout.write(`  ${Math.min(off + CHUNK, rows.length)}/${rows.length} · ${fixed.size} fixes\r`);
  }
  console.log('');
  for (const [key, name] of [...fixed].slice(0, 12)) console.log(`  ${key} → ${name}`);

  if (DRY_RUN) { console.log(`\nDRY_RUN — ${fixed.size} names would change.`); await sql.end(); return; }

  for (const [key, name] of fixed) {
    await sql`UPDATE "Investigation" SET "scandalName" = ${name}, "updatedAt" = now() WHERE "scandalKey" = ${key}`;
  }
  console.log(`\napplied ${fixed.size} name fixes.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
