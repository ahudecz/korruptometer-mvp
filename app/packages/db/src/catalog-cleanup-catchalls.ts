/**
 * Case Catalog — dissolve over-broad catch-all scandals and re-cluster tightly.
 *
 * The scandal-merge produced a few generic buckets ("[person] korrupciós
 * ügyei/hálózata", "... sanyargatása") that lumped dozens of unrelated affairs
 * and carried fabricated round damages. This pass:
 *   1. dissolves those catch-alls (un-merges their members),
 *   2. re-clusters the freed members with a STRICT prompt (specific affairs
 *      only — never a person's general corruption bucket),
 *   3. re-prices damage per case,
 *   4. caps any damage > 1000 Mrd Ft and flags it low-confidence (so fabricated
 *      "high" figures stop masquerading as solid).
 *
 * DRY_RUN=1 previews the re-clustering and mutates nothing.
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
const CAP = 1_000_000_000_000; // 1000 Mrd Ft sanity ceiling
const PATTERN = '(korrupciós ügyei|korrupciós hálózat|sanyargat)';
const CHUNK = 25;

const sql = postgres(DB_URL, { prepare: false, max: 4 });
const ai = new Anthropic({ apiKey: API_KEY });

const ASSIGN_TOOL: Anthropic.Tool = {
  name: 'assign_scandals',
  description:
    'Cluster Hungarian corruption cases into SPECIFIC scandals and sanity-check each damage. A scandal is ONE concrete affair (a specific project, contract, institution or event). NEVER create a generic bucket named after a person or the government (no "X korrupciós ügyei", no "X hálózata"). If a case does not clearly belong with others, give it its own unique scandalKey. The provided damage is a noisy regex figure — correct it to a plausible value for THIS specific case.',
  input_schema: {
    type: 'object',
    properties: {
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'number' },
            scandalKey: { type: 'string', description: 'kebab-case, SPECIFIC ügy azonosító.' },
            scandalName: { type: 'string', description: 'Konkrét magyar ügynév (nem általános).' },
            damageMrd: { type: 'number', description: 'Reális kár MILLIÁRD Ft-ban (0 ha ismeretlen).' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
          required: ['i', 'scandalKey', 'scandalName', 'damageMrd', 'confidence'],
        },
      },
    },
    required: ['assignments'],
  },
};

type Row = { id: string; caseName: string | null; person: string | null; inst: string | null; articleCount: number };
type Assign = { key: string; name: string; dmgHuf: number; conf: string };
const CONF_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

async function topHeadline(id: string): Promise<string | null> {
  const r = await sql<{ title: string }[]>`
    SELECT k.title FROM "InvestigationArticleLink" l
    JOIN "KMonitorArticle" k ON k."newsId"=l."articleId"::int
    WHERE l."investigationId"=${id} ORDER BY k."pubTime" DESC LIMIT 1`;
  return r[0]?.title ?? null;
}

async function main() {
  // members of the catch-all scandals
  const members = await sql<Row[]>`
    SELECT id, "caseName", "primaryPersonName" AS person, "primaryEntityName" AS inst, "articleCount"
    FROM "Investigation"
    WHERE "scandalKey" IN (
      SELECT DISTINCT "scandalKey" FROM "Investigation"
      WHERE "scandalKey" IS NOT NULL AND "scandalName" ~* ${PATTERN}
    )`;
  console.log(`${members.length} cases in catch-all scandals to re-cluster (DRY_RUN=${DRY_RUN})`);

  if (!DRY_RUN) {
    // dissolve: canonicals (status='new' w/ scandalKey) lost their caseName/damage — restore
    const canon = await sql<{ id: string }[]>`
      SELECT id FROM "Investigation"
      WHERE status='new' AND "scandalKey" IS NOT NULL AND "scandalName" ~* ${PATTERN}`;
    for (const c of canon) {
      const h = await topHeadline(c.id);
      await sql`UPDATE "Investigation" SET "caseName"=${h} WHERE id=${c.id}`;
      await sql`DELETE FROM "DamageEstimate" WHERE "investigationId"=${c.id}`;
    }
    const ids = members.map((m) => m.id);
    await sql`
      UPDATE "Investigation"
      SET status='new', "mergedIntoId"=NULL, "scandalKey"=NULL, "scandalName"=NULL,
          "articleCount"=(SELECT count(*) FROM "InvestigationArticleLink" l WHERE l."investigationId"="Investigation".id),
          "updatedAt"=now()
      WHERE id = ANY(${sql.array(ids)}::uuid[])`;
    console.log(`dissolved ${canon.length} catch-alls → ${members.length} standalone cases`);
  }

  // re-cluster tightly
  const assigned = new Map<string, Assign>();
  const registry: { key: string; name: string }[] = [];
  const regKeys = new Set<string>();
  for (let off = 0; off < members.length; off += CHUNK) {
    const chunk = members.slice(off, off + CHUNK);
    const regList = registry.length ? registry.map((r) => `- ${r.key}: ${r.name}`).join('\n') : '(még nincs)';
    const caseList = chunk.map((r, j) => `${j + 1}. ${r.caseName ?? '—'} — ${r.person ?? '—'} — ${r.inst ?? '—'}`).join('\n');
    let assignments: { i: number; scandalKey: string; scandalName: string; damageMrd: number; confidence: string }[] = [];
    try {
      const res = await ai.messages.create({
        model: MODEL, max_tokens: 4000, tools: [ASSIGN_TOOL],
        tool_choice: { type: 'tool', name: ASSIGN_TOOL.name },
        messages: [{ role: 'user', content: `LÉTEZŐ KONKRÉT ÜGYEK:\n${regList}\n\nESETEK (konkrét ügyekbe rendezd, ne általános vödörbe):\n${caseList}` }],
      });
      const b = res.content.find((x) => x.type === 'tool_use');
      if (b && b.type === 'tool_use') {
        const inp = b.input as { assignments?: typeof assignments };
        if (Array.isArray(inp.assignments)) assignments = inp.assignments;
      }
    } catch (e) {
      console.error(`chunk ${off} failed: ${(e as Error).message}`);
    }
    for (const a of assignments) {
      const r = chunk[a.i - 1];
      if (!r) continue;
      const key = a.scandalKey.trim().toLowerCase();
      assigned.set(r.id, { key, name: a.scandalName.trim(), dmgHuf: Math.max(0, Math.round((a.damageMrd ?? 0) * 1e9)), conf: a.confidence ?? 'low' });
      if (!regKeys.has(key)) { regKeys.add(key); registry.push({ key, name: a.scandalName.trim() }); }
    }
    process.stdout.write(`  ${Math.min(off + CHUNK, members.length)}/${members.length} · ${registry.length} scandals\r`);
  }
  console.log('');

  const groups = new Map<string, Row[]>();
  for (const r of members) {
    const key = assigned.get(r.id)?.key ?? `solo:${r.id}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  const multi = [...groups.entries()].filter(([, m]) => m.length > 1).sort((a, b) => b[1].length - a[1].length);
  console.log(`re-clustered into ${groups.size} scandals (${multi.length} multi-case). Biggest:`);
  for (const [k, m] of multi.slice(0, 12)) console.log(`  • ${assigned.get(m[0]!.id)?.name ?? k} — ${m.length}`);

  if (DRY_RUN) { console.log('\nDRY_RUN — nothing written.'); await sql.end(); return; }

  for (const [key, ms] of groups) {
    ms.sort((a, b) => b.articleCount - a.articleCount);
    const canon = ms[0]!;
    const a0 = assigned.get(canon.id);
    const name = a0?.name ?? canon.caseName ?? key;
    const isMulti = ms.length > 1 && !key.startsWith('solo:');
    const huf = Math.max(...ms.map((m) => assigned.get(m.id)?.dmgHuf ?? 0), 0);
    const conf = ms.map((m) => assigned.get(m.id)?.conf ?? 'low').sort((x, y) => CONF_RANK[y]! - CONF_RANK[x]!)[0] ?? 'low';
    const totalArticles = ms.reduce((s, m) => s + m.articleCount, 0);
    await sql.begin(async (tx) => {
      await tx`UPDATE "Investigation" SET "scandalKey"=${isMulti ? key : null}, "scandalName"=${isMulti ? name : null}, "caseName"=${name}, "articleCount"=${isMulti ? totalArticles : canon.articleCount}, "updatedAt"=now() WHERE id=${canon.id}`;
      await upsertDamage(tx, canon.id, huf, conf, ms.length);
      if (isMulti) for (const m of ms.slice(1)) await tx`UPDATE "Investigation" SET status='merged', "mergedIntoId"=${canon.id}, "scandalKey"=${key}, "scandalName"=${name}, "updatedAt"=now() WHERE id=${m.id}`;
    });
  }

  // global sanity cap + flag
  const capped = await sql`
    UPDATE "DamageEstimate" d SET "totalHighHuf"=${CAP}, "totalLowHuf"=LEAST(d."totalLowHuf", ${CAP}), confidence='low', "computedAt"=now()
    FROM "Investigation" i
    WHERE i.id=d."investigationId" AND i."caseKeySource" LIKE 'kmonitor_%' AND d."totalHighHuf" > ${CAP}
    RETURNING d."investigationId"`;
  console.log(`\ndone. capped ${capped.length} damage figures at ${CAP / 1e9} Mrd (flagged low).`);
  await sql.end();
}

async function upsertDamage(tx: TransactionSql<{}>, id: string, huf: number, conf: string, n: number) {
  if (huf <= 0) { await tx`DELETE FROM "DamageEstimate" WHERE "investigationId"=${id}`; return; }
  await tx`
    INSERT INTO "DamageEstimate" ("investigationId","totalLowHuf","totalHighHuf",confidence,components,"inputsHash")
    VALUES (${id}, ${huf}, ${huf}, ${conf}, ${sql.json([{ mechanism: 'other', lowHuf: huf, highHuf: huf, method: 'claim_consolidation', inputs: { cases: n }, formula: 'ügy-szintű, LLM által javított', citation: null, notes: 'LLM-ellenőrzött kár.' }])}, ${'0'.repeat(64)})
    ON CONFLICT ("investigationId") DO UPDATE SET "totalLowHuf"=EXCLUDED."totalLowHuf", "totalHighHuf"=EXCLUDED."totalHighHuf", confidence=EXCLUDED.confidence, components=EXCLUDED.components, "computedAt"=now()`;
}

main().catch((e) => { console.error(e); process.exit(1); });
