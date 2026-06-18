/**
 * Case Catalog — scandal clustering + merge + damage re-pricing (focused).
 *
 * Targets ONLY the cases that pollute the top of the damage sort: those with an
 * estimated damage ≥ 20 Mrd Ft (the MNB-scandal fragments and the regex
 * "largest number" artifacts). For each, one LLM pass returns (a) a scandalKey
 * so fragments of the same affair collapse into one case, and (b) a sane damage
 * figure (so a half-million-forint job stops being ranked at 500 Mrd). Merge is
 * via Investigation.mergedIntoId (status='merged'); the catalog view hides
 * merged rows. The long tail of small/distinct one-off cases is left untouched.
 *
 * DRY_RUN=1 prints the plan and mutates nothing.
 * Usage: DRY_RUN=1 pnpm --filter @korr/db tsx src/catalog-scandal-merge.ts
 *        pnpm --filter @korr/db tsx src/catalog-scandal-merge.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import Anthropic from '@anthropic-ai/sdk';
import postgres, { type TransactionSql } from 'postgres';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
const DRY_RUN = process.env.DRY_RUN === '1';
const MODEL = process.env.INVESTIGATION_EXTRACTOR_MODEL ?? 'claude-haiku-4-5-20251001';
const THRESHOLD = 20_000_000_000; // 20 Mrd Ft
const CHUNK = 25;

const sql = postgres(DB_URL, { prepare: false, max: 4 });
const ai = new Anthropic({ apiKey: API_KEY });

const ASSIGN_TOOL: Anthropic.Tool = {
  name: 'assign_scandals',
  description:
    'Cluster Hungarian corruption cases into scandals and sanity-check each damage figure. Cases about the SAME affair (same core entities/matter, even across different people or companies) MUST share scandalKey. The given damage is the largest number a regex found in the article — often wrong; correct it to the plausible damage for THIS case.',
  input_schema: {
    type: 'object',
    properties: {
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'number', description: '1-alapú sorszám a kötegben.' },
            scandalKey: { type: 'string', description: 'kebab-case kulcs, pl. "mnb-alapitvany-botrany". Létező kulcs ha ugyanaz az ügy.' },
            scandalName: { type: 'string', description: 'Rövid magyar ügynév.' },
            damageMrd: { type: 'number', description: 'Reális vélelmezett kár MILLIÁRD forintban ennél az ügynél (0 ha nem megállapítható). Ne a legnagyobb említett számot.' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
          required: ['i', 'scandalKey', 'scandalName', 'damageMrd', 'confidence'],
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
type Assign = { key: string; name: string; dmgHuf: number; conf: string };
const CONF_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

async function main() {
  const rows = await sql<Row[]>`
    SELECT i.id, i."caseName", i."primaryPersonName" AS person,
           i."primaryEntityName" AS inst, i."articleCount"
    FROM "Investigation" i
    JOIN "DamageEstimate" d ON d."investigationId" = i.id
    WHERE i."caseKeySource" LIKE 'kmonitor_%' AND i.status = 'new'
      AND d."totalHighHuf" >= ${THRESHOLD}
    ORDER BY d."totalHighHuf" DESC
  `;
  console.log(`focused pass on ${rows.length} high-damage cases (DRY_RUN=${DRY_RUN})`);

  const registry: { key: string; name: string }[] = [];
  const regKeys = new Set<string>();
  const assigned = new Map<string, Assign>();

  for (let off = 0; off < rows.length; off += CHUNK) {
    const chunk = rows.slice(off, off + CHUNK);
    const regList = registry.length
      ? registry.map((r) => `- ${r.key}: ${r.name}`).join('\n')
      : '(még nincs)';
    const caseList = chunk
      .map((r, j) => `${j + 1}. ${r.caseName ?? '—'} — ${r.person ?? '—'} — ${r.inst ?? '—'}`)
      .join('\n');
    let assignments: { i: number; scandalKey: string; scandalName: string; damageMrd: number; confidence: string }[] = [];
    try {
      const res = await ai.messages.create({
        model: MODEL,
        max_tokens: 4000,
        tools: [ASSIGN_TOOL],
        tool_choice: { type: 'tool', name: ASSIGN_TOOL.name },
        messages: [
          {
            role: 'user',
            content: `LÉTEZŐ BOTRÁNYOK (kulcs: név):\n${regList}\n\nESETEK (rendeld botrányhoz + javítsd a kárt):\n${caseList}`,
          },
        ],
      });
      const block = res.content.find((b) => b.type === 'tool_use');
      if (block && block.type === 'tool_use') {
        const inp = block.input as { assignments?: typeof assignments };
        if (Array.isArray(inp.assignments)) assignments = inp.assignments;
      }
    } catch (e) {
      console.error(`\n  chunk ${off} failed: ${(e as Error).message}`);
    }
    for (const a of assignments) {
      const r = chunk[a.i - 1];
      if (!r) continue;
      const key = a.scandalKey.trim().toLowerCase();
      assigned.set(r.id, {
        key,
        name: a.scandalName.trim(),
        dmgHuf: Math.max(0, Math.round((a.damageMrd ?? 0) * 1e9)),
        conf: a.confidence ?? 'low',
      });
      if (!regKeys.has(key)) {
        regKeys.add(key);
        registry.push({ key, name: a.scandalName.trim() });
      }
    }
    process.stdout.write(`  ${Math.min(off + CHUNK, rows.length)}/${rows.length} · ${registry.length} scandals\r`);
  }
  console.log('');

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = assigned.get(r.id)?.key ?? `solo:${r.id}`;
    const g = groups.get(key) ?? groups.set(key, []).get(key)!;
    g.push(r);
  }
  const multi = [...groups.entries()].filter(([, m]) => m.length > 1).sort((a, b) => b[1].length - a[1].length);
  console.log(`${rows.length} cases → ${groups.size} scandals (${multi.length} multi-case). Top merges:`);
  for (const [key, members] of multi.slice(0, 15)) {
    const a0 = assigned.get(members[0]!.id);
    const maxDmg = Math.max(...members.map((m) => assigned.get(m.id)?.dmgHuf ?? 0));
    console.log(`  • ${a0?.name ?? key} — ${members.length} eset → 1 · ${(maxDmg / 1e9).toFixed(0)} Mrd`);
  }

  if (DRY_RUN) {
    console.log('\nDRY_RUN — no changes written.');
    await sql.end();
    return;
  }

  let mergedAway = 0;
  for (const [key, members] of groups) {
    if (key.startsWith('solo:')) {
      // single case in this set — just re-price + tag
      const r = members[0]!;
      const a = assigned.get(r.id);
      if (!a) continue;
      await applyOne(r.id, a.key === key ? null : a.key, a, r.articleCount, [a]);
      continue;
    }
    members.sort((x, y) => y.articleCount - x.articleCount);
    const canon = members[0]!;
    const name = assigned.get(canon.id)?.name ?? canon.caseName ?? key;
    const totalArticles = members.reduce((s, m) => s + m.articleCount, 0);
    const groupAssigns = members.map((m) => assigned.get(m.id)).filter(Boolean) as Assign[];
    await sql.begin(async (tx) => {
      await applyOneTx(tx, canon.id, key, name, totalArticles, groupAssigns);
      for (const m of members.slice(1)) {
        await tx`
          UPDATE "Investigation"
          SET status='merged', "mergedIntoId"=${canon.id}, "scandalKey"=${key},
              "scandalName"=${name}, "updatedAt"=now()
          WHERE id=${m.id}`;
        mergedAway++;
      }
    });
  }
  console.log(`\napplied: ${groups.size} scandals, ${mergedAway} fragments merged away.`);
  await sql.end();
}

function bestDamage(assigns: Assign[]): { huf: number; conf: string } {
  const huf = Math.max(...assigns.map((a) => a.dmgHuf), 0);
  const conf = assigns.map((a) => a.conf).sort((x, y) => CONF_RANK[y]! - CONF_RANK[x]!)[0] ?? 'low';
  return { huf, conf };
}

async function applyOne(id: string, key: string | null, a: Assign, articles: number, assigns: Assign[]) {
  await sql.begin((tx) => applyOneTx(tx, id, key, a.name, articles, assigns));
}

async function applyOneTx(tx: TransactionSql<{}>, id: string, key: string | null, name: string, articles: number, assigns: Assign[]) {
  await tx`
    UPDATE "Investigation"
    SET "scandalKey"=${key}, "scandalName"=${name}, "caseName"=${name},
        "articleCount"=${articles}, "updatedAt"=now()
    WHERE id=${id}`;
  const { huf, conf } = bestDamage(assigns);
  if (huf > 0) {
    await tx`
      INSERT INTO "DamageEstimate" ("investigationId","totalLowHuf","totalHighHuf",confidence,components,"inputsHash")
      VALUES (${id}, ${huf}, ${huf}, ${conf},
              ${sql.json([{ mechanism: 'other', lowHuf: huf, highHuf: huf, method: 'claim_consolidation', inputs: { mergedCases: assigns.length }, formula: 'botrány-szintű, LLM által javított kár', citation: null, notes: 'LLM által ellenőrzött, botrány-szintű kárbecslés.' }])},
              ${'0'.repeat(64)})
      ON CONFLICT ("investigationId") DO UPDATE
        SET "totalLowHuf"=EXCLUDED."totalLowHuf", "totalHighHuf"=EXCLUDED."totalHighHuf",
            confidence=EXCLUDED.confidence, components=EXCLUDED.components, "computedAt"=now()`;
  } else {
    // LLM says no real damage → drop the artifact estimate entirely
    await tx`DELETE FROM "DamageEstimate" WHERE "investigationId"=${id}`;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
