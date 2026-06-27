/**
 * Case Catalog — scandalKey population (grouping-only, non-destructive).
 *
 * Clusters every NAMED investigation (caseName not null, status='new') into
 * matter-level scandals and writes ONLY Investigation.scandalKey +
 * scandalName. It does NOT merge, change status, or touch DamageEstimate —
 * the grouping is just a reversible tag. (Merging/re-pricing stays the job of
 * catalog-scandal-merge.ts.)
 *
 * The scandal registry is SEEDED with the public "kiemelt ügyek"
 * (app/apps/web/app/_home/ugyek-config.ts) so matching investigations adopt
 * those exact keys/names and the rest follow the same "X botrány / X-ügy"
 * pattern. The config is read-only — never modified here.
 *
 * Long tail: a one-off case gets its OWN scandalKey/scandalName (= its
 * caseName) so every named investigation ends up grouped (size 1 for
 * singletons).
 *
 * DRY_RUN=1 prints the clustering plan and mutates nothing.
 * Usage: DRY_RUN=1 pnpm --filter @korr/db tsx src/catalog-scandal-key.ts
 *        pnpm --filter @korr/db tsx src/catalog-scandal-key.ts
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
const CHUNK = 25;

const sql = postgres(DB_URL, { prepare: false, max: 4 });
const ai = new Anthropic({ apiKey: API_KEY });

// Seed scandals from the public "kiemelt ügyek" — the naming pattern.
const SEED: { key: string; name: string }[] = [
  { key: 'nka-botrany', name: 'NKA botrány' },
  { key: 'lelegeztetogep', name: 'Lélegeztetőgép-botrány' },
  { key: 'hatvanpuszta', name: 'Hatvanpuszta' },
  { key: 'aranykonvoj', name: 'Aranykonvoj-ügy' },
  { key: 'mnb-botrany', name: 'MNB botrány' },
  { key: 'zsolt-bacsi', name: 'Zsolti bácsi ügy' },
];

const ASSIGN_TOOL: Anthropic.Tool = {
  name: 'assign_scandals',
  description:
    'Cluster Hungarian corruption cases into matter-level scandals. Cases about the SAME affair (same core matter, even across different people or companies) MUST share scandalKey. A genuinely standalone case gets its own unique scandalKey. Reuse an EXISTING key from the provided list whenever the case belongs to that scandal.',
  input_schema: {
    type: 'object',
    properties: {
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'number', description: '1-alapú sorszám a kötegben.' },
            scandalKey: {
              type: 'string',
              description:
                'kebab-case kulcs, pl. "mnb-alapitvany-botrany". HASZNÁLD a meglévő kulcsot ha ugyanaz az ügy.',
            },
            scandalName: { type: 'string', description: 'Rövid magyar ügynév, minta: "NKA botrány", "Aranykonvoj-ügy".' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
          required: ['i', 'scandalKey', 'scandalName', 'confidence'],
        },
      },
    },
    required: ['assignments'],
  },
};

type Row = {
  id: string;
  caseName: string | null;
  person: string | null;
  inst: string | null;
  articleCount: number;
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'eset';
}

async function main() {
  const rows = await sql<Row[]>`
    SELECT i.id, i."caseName", i."primaryPersonName" AS person,
           i."primaryEntityName" AS inst, i."articleCount"
    FROM "Investigation" i
    WHERE i."caseName" IS NOT NULL AND i.status = 'new'
    ORDER BY lower(coalesce(i."primaryEntityName",'')),
             lower(coalesce(i."primaryPersonName",'')), i."caseName"
  `;
  console.log(`scandalKey pass on ${rows.length} named cases (DRY_RUN=${DRY_RUN})`);

  const registry: { key: string; name: string }[] = [...SEED];
  const regKeys = new Set(SEED.map((s) => s.key));
  const assigned = new Map<string, { key: string; name: string }>();

  for (let off = 0; off < rows.length; off += CHUNK) {
    const chunk = rows.slice(off, off + CHUNK);
    const regList = registry.map((r) => `- ${r.key}: ${r.name}`).join('\n');
    const caseList = chunk
      .map((r, j) => `${j + 1}. ${r.caseName ?? '—'} — ${r.person ?? '—'} — ${r.inst ?? '—'}`)
      .join('\n');
    let assignments: { i: number; scandalKey: string; scandalName: string; confidence: string }[] = [];
    const content = `LÉTEZŐ BOTRÁNYOK (kulcs: név):\n${regList}\n\nESETEK (rendeld botrányhoz; egyedi ügy saját kulcsot kap):\n${caseList}`;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await ai.messages.create({
          model: MODEL,
          max_tokens: 4000,
          tools: [ASSIGN_TOOL],
          tool_choice: { type: 'tool', name: ASSIGN_TOOL.name },
          messages: [{ role: 'user', content }],
        });
        const block = res.content.find((b) => b.type === 'tool_use');
        if (block && block.type === 'tool_use') {
          const inp = block.input as { assignments?: typeof assignments };
          if (Array.isArray(inp.assignments)) assignments = inp.assignments;
        }
        break;
      } catch (e) {
        const msg = (e as Error).message;
        const retryable = /50\d|429|overloaded|timeout|ECONNRESET|fetch failed/i.test(msg);
        if (attempt === 4 || !retryable) {
          console.error(`\n  chunk ${off} failed after ${attempt} attempts: ${msg}`);
          break;
        }
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
    for (const a of assignments) {
      const r = chunk[a.i - 1];
      if (!r) continue;
      const key = a.scandalKey.trim().toLowerCase();
      const name = a.scandalName.trim();
      assigned.set(r.id, { key, name });
      if (!regKeys.has(key)) {
        regKeys.add(key);
        registry.push({ key, name });
      }
    }
    // Fallback: any row the LLM skipped gets its own key (= caseName).
    for (const r of chunk) {
      if (!assigned.has(r.id)) {
        assigned.set(r.id, { key: slug(r.caseName ?? r.id), name: r.caseName ?? '—' });
      }
    }
    process.stdout.write(`  ${Math.min(off + CHUNK, rows.length)}/${rows.length} · ${registry.length} scandals\r`);
  }
  console.log('');

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = assigned.get(r.id)!.key;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  const multi = [...groups.entries()].filter(([, m]) => m.length > 1).sort((a, b) => b[1].length - a[1].length);
  console.log(`${rows.length} cases → ${groups.size} scandals (${multi.length} multi-case, ${groups.size - multi.length} singletons).`);
  console.log('Top scandals by case count:');
  for (const [key, members] of multi.slice(0, 25)) {
    const name = assigned.get(members[0]!.id)?.name ?? key;
    console.log(`  ${String(members.length).padStart(4)} · ${name}  [${key}]`);
  }

  if (DRY_RUN) {
    console.log('\nDRY_RUN — no changes written.');
    await sql.end();
    return;
  }

  let written = 0;
  for (const r of rows) {
    const a = assigned.get(r.id)!;
    await sql`
      UPDATE "Investigation"
      SET "scandalKey" = ${a.key}, "scandalName" = ${a.name}, "updatedAt" = now()
      WHERE id = ${r.id}`;
    written++;
    if (written % 200 === 0) process.stdout.write(`  written ${written}/${rows.length}\r`);
  }
  console.log(`\napplied scandalKey/scandalName to ${written} investigations (no merge, no damage change).`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
