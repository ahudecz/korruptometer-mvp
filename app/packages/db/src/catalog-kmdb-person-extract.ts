/**
 * Case Catalog — LLM extraction from the KmdbArticle corpus, per person.
 *
 * Unlike the existing catalog-*.ts pipeline (which reads from the now-empty
 * "KMonitorArticle" table via a bootstrap → llm-name → scandal-key → damage
 * chain), this script reads directly from "KmdbArticle" (the 64k-row
 * K-Monitor HuggingFace corpus, which the other scripts never touch), and
 * does clustering + naming + scandalKey + damage estimate in one Haiku tool
 * call per chunk. Large persons get chunked (CHUNK_SIZE articles/call) to
 * stay within context and keep clustering quality good; each chunk sees the
 * scandalKeys created by earlier chunks for the SAME person so it can reuse
 * them instead of splitting one story across keys.
 *
 * Does NOT create InvestigationArticleLink rows (KmdbArticle has no matching
 * article_source enum value yet) — case pages already fall back to querying
 * KmdbArticle directly by person for "Kapcsolódó hírek" when no links exist.
 *
 * Usage:
 *   tsx src/catalog-kmdb-person-extract.ts "Semjén Zsolt"        (one person)
 *   tsx src/catalog-kmdb-person-extract.ts --batch 10            (tracked-28
 *     people, smallest article-count first, stop once cumulative cost hits
 *     the USD cap given as the argument)
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
const CHUNK_SIZE = 300;

const sql = postgres(DB_URL, { prepare: false, max: 2 });
const ai = new Anthropic({ apiKey: API_KEY });

const TRACKED_PEOPLE = [
  'Orbán Viktor', 'Szíjj László', 'Lázár János', 'Szijjártó Péter', 'Habony Árpád',
  'Hankó Balázs', 'Takács Péter', 'Balásy Gyula', 'Rogán Antal', 'Tiborcz István',
  'Matolcsy György', 'Semjén Zsolt', 'Kósa Lajos', 'Orbán Balázs', 'Lezsák Sándor',
  'Hernádi Zsolt', 'Sára Botond', 'Leisztinger Tamás', 'Balázs Attila', 'Emőri Gábor',
  'Palkovics László', 'Barta-Eke Gyula', 'Garancsi István', 'Gattyán György',
  'Kocsis Máté', 'Homlok Zsolt', 'Mészáros Lőrinc',
]; // Hamar Endre excluded: 0 KmdbArticle rows.

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').trim();
}

const TOOL: Anthropic.Tool = {
  name: 'extract_cases',
  description:
    'Cluster Hungarian news headlines about ONE person into distinct, real corruption/controversy cases. Each case = one specific matter (not the person\'s whole career, not a whole institution\'s total budget/spending — those are NOT case-specific damage). Skip headlines that are noise (unrelated mentions, interviews with no substantive claim). A case needs at least 1 headline making a concrete claim.',
  input_schema: {
    type: 'object',
    properties: {
      cases: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            caseName: { type: 'string', description: 'Rövid, beszédes magyar ügynév (max 8 szó).' },
            synopsis: { type: 'string', description: '2-3 mondatos magyar összefoglaló: mi történt, milyen összeg, milyen intézmény/ellenérdekű fél.' },
            primaryEntityName: { type: 'string', description: 'A legfontosabb érintett intézmény/cég neve.' },
            offences: { type: 'array', items: { type: 'string' }, description: 'Vélelmezett jogsértések magyarul, pl. "Közpénzek aránytalan elosztása".' },
            allegedDamageHuf: { type: 'number', description: 'Legjobb egyetlen becslés a vélelmezett kárra/érintett összegre forintban (0 ha nem megállapítható). A cikkek által KIFEJEZETTEN az ügyhöz kötött összeg. SOHA ne egy intézmény/alap teljes, sok éves vagy sok kedvezményezettre szóló összköltését/vagyonát add meg kárként — az nem ügy-specifikus kár, akkor 0-t adj vagy egy szűkebb, konkrétan az ügyhöz köthető részösszeget.' },
            damageConfidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            damageReasoning: { type: 'string', description: 'Magyarul: hogyan jutottál az összeghez, és melyik címsorból.' },
            bestEvidenceIndex: { type: 'number', description: 'Melyik címsor (1-alapú sorszám) támasztja alá legjobban az összeget. 0 ha allegedDamageHuf=0.' },
            scandalKeySlug: { type: 'string', description: 'kebab-case egyedi azonosító, pl. "semjen-egyhazi-normativa". HASZNÁLD ÚJRA a megadott meglévő kulcsot, ha a klaszter ugyanarról az ügyről szól.' },
            scandalName: { type: 'string', description: 'Rövid magyar ügynév megjelenítéshez, pl. "Egyházi normatíva-különbözet".' },
            articleIndices: { type: 'array', items: { type: 'number' }, description: '1-alapú sorszámok az ide tartozó összes címsorra.' },
          },
          required: ['caseName', 'synopsis', 'primaryEntityName', 'offences', 'allegedDamageHuf', 'damageConfidence', 'damageReasoning', 'bestEvidenceIndex', 'scandalKeySlug', 'scandalName', 'articleIndices'],
        },
      },
    },
    required: ['cases'],
  },
};

type CaseOut = {
  caseName: string;
  synopsis: string;
  primaryEntityName: string;
  offences: string[];
  allegedDamageHuf: number;
  damageConfidence: 'low' | 'medium' | 'high';
  damageReasoning: string;
  bestEvidenceIndex: number;
  scandalKeySlug: string;
  scandalName: string;
  articleIndices: number[];
};

type Article = { news_id: number; title: string; description: string | null; source_url: string; newspaper: string | null; pub_time: string | null };

const budget = { spent: 0, cap: Infinity };

async function runChunk(personName: string, personNorm: string, arts: Article[], existingKeys: Map<string, string>): Promise<number> {
  if (budget.spent >= budget.cap) return 0;

  const existingNote = existingKeys.size
    ? `\nMár létező ügyek ehhez a személyhez (HASZNÁLD ÚJRA a kulcsot, ha egy klaszter ugyanarról az ügyről szól, ne hozz létre duplikátumot):\n${[...existingKeys.entries()].map(([k, n]) => `- ${k}: ${n}`).join('\n')}\n`
    : '';
  const list = arts
    .map((a, i) => `${i + 1}. [${a.newspaper ?? '?'}, ${(a.pub_time ?? '').slice(0, 10)}] ${a.title}${a.description ? ` — ${a.description}` : ''}`)
    .join('\n');

  const res = await ai.messages.create({
    model: MODEL,
    max_tokens: 12000,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: TOOL.name },
    messages: [{ role: 'user', content: `Személy: ${personName}${existingNote}\nCímsorok (dátum szerint csökkenő sorrendben):\n\n${list}` }],
  });
  const cost = (res.usage.input_tokens / 1e6) * 1.0 + (res.usage.output_tokens / 1e6) * 5.0;
  budget.spent += cost;
  console.log(`  Haiku: ${res.usage.input_tokens} in / ${res.usage.output_tokens} out ~ $${cost.toFixed(4)} (running total $${budget.spent.toFixed(3)}, stop_reason: ${res.stop_reason})`);

  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') { console.error('  no tool_use in response'); return cost; }
  const parsed = block.input as { cases?: CaseOut[] };
  const cases = parsed.cases ?? [];
  if (res.stop_reason === 'max_tokens') console.warn('  WARNING: truncated at max_tokens — results may be incomplete.');
  console.log(`  extracted ${cases.length} cases`);

  const today = new Date().toISOString().slice(0, 10);

  for (const c of cases) {
    const scandalKey = c.scandalKeySlug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const articleCount = c.articleIndices.length;
    const canonicalKey = createHash('sha256').update(`kmdb_llm_v1:${personNorm}:${scandalKey}`).digest('hex');

    const dup = await sql<{ id: string }[]>`SELECT id FROM "Investigation" WHERE "canonicalCaseKey" = ${canonicalKey} LIMIT 1`;
    if (dup[0]) { console.log(`    SKIP (exists): ${c.caseName}`); continue; }

    const [inv] = await sql<{ id: string }[]>`
      INSERT INTO "Investigation" (
        status, "primaryPersonName", "primaryPersonNormalized", "primaryEntityName",
        "caseName", "scandalKey", "scandalName", summary, "articleCount",
        "offenceTypes", "canonicalCaseKey", "caseKeySource"
      ) VALUES (
        'new', ${personName}, ${personNorm}, ${c.primaryEntityName},
        ${c.caseName}, ${scandalKey}, ${c.scandalName}, ${c.synopsis}, ${articleCount},
        ${c.offences}, ${canonicalKey}, 'kmdb_llm_v1'
      )
      RETURNING id
    `;
    existingKeys.set(scandalKey, c.scandalName);

    const amt = Math.round(c.allegedDamageHuf ?? 0);
    if (amt > 0) {
      const ev = arts[(c.bestEvidenceIndex ?? 1) - 1] ?? arts[c.articleIndices[0]! - 1];
      const comp = [{
        mechanism: 'other',
        lowHuf: String(amt),
        highHuf: String(amt),
        method: 'claim_consolidation',
        inputs: {
          formula: 'a sajtó által vélelmezett kár/érintett összeg (K-Monitor kmdb_base, LLM-kinyerés)',
          citation: ev ? { studyId: 'sajtó', sourceUrl: ev.source_url, lastVerifiedAt: today } : null,
        },
        notes: `${c.damageReasoning.slice(0, 300)}${ev ? ` — forrás: „${ev.title.slice(0, 100)}”` : ''}`,
      }];
      await sql`
        INSERT INTO "DamageEstimate" ("investigationId", "totalLowHuf", "totalHighHuf", confidence, basis, components, "inputsHash")
        VALUES (${inv.id}, ${amt}, ${amt}, ${c.damageConfidence}, 'alleged_reported',
                ${sql.json(comp as Parameters<typeof sql.json>[0])}, ${createHash('sha256').update(inv.id + ':kmdb_llm_v1').digest('hex')})
        ON CONFLICT ("investigationId") DO NOTHING
      `;
    }
    console.log(`    + ${c.caseName} (${scandalKey}) — ${articleCount} cikk, ${amt > 0 ? `${(amt / 1e9).toFixed(1)} Mrd` : 'nincs kár'}`);
  }
  return cost;
}

async function processPerson(personName: string): Promise<void> {
  const arts = await sql<Article[]>`
    SELECT news_id, title, description, source_url, newspaper, pub_time
    FROM "KmdbArticle" WHERE ${personName} = ANY(persons) ORDER BY pub_time DESC
  `;
  console.log(`\n=== ${personName}: ${arts.length} KmdbArticle rows ===`);
  if (arts.length === 0) return;

  const existingRows = await sql<{ scandalKey: string; scandalName: string | null }[]>`
    SELECT DISTINCT "scandalKey", "scandalName" FROM "Investigation"
    WHERE "primaryPersonName" = ${personName} AND "scandalKey" IS NOT NULL
  `;
  const existingKeys = new Map(existingRows.map((r) => [r.scandalKey, r.scandalName ?? r.scandalKey]));
  const personNorm = norm(personName);

  for (let i = 0; i < arts.length; i += CHUNK_SIZE) {
    if (budget.spent >= budget.cap) {
      console.log(`  BUDGET CAP ($${budget.cap}) reached — stopping mid-person at chunk offset ${i}.`);
      return;
    }
    const chunk = arts.slice(i, i + CHUNK_SIZE);
    console.log(` chunk ${i}-${i + chunk.length} of ${arts.length}`);
    await runChunk(personName, personNorm, chunk, existingKeys);
  }
}

async function main() {
  const arg = process.argv[2];
  if (arg === '--batch') {
    budget.cap = Number(process.argv[3] ?? '10');
    console.log(`BATCH MODE: ${TRACKED_PEOPLE.length} people, cap $${budget.cap}, smallest article-count first.\n`);

    const counts = await Promise.all(
      TRACKED_PEOPLE.map(async (p) => {
        const r = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM "KmdbArticle" WHERE ${p} = ANY(persons)`;
        return { person: p, n: r[0]!.n };
      }),
    );
    counts.sort((a, b) => a.n - b.n);

    for (const { person, n } of counts) {
      if (budget.spent >= budget.cap) {
        console.log(`\nBUDGET CAP reached ($${budget.spent.toFixed(3)} >= $${budget.cap}) — skipping remaining people. Not processed: ${counts.slice(counts.findIndex((x) => x.person === person)).map((x) => x.person).join(', ')}`);
        break;
      }
      await processPerson(person);
      console.log(`--- running total: $${budget.spent.toFixed(3)} ---`);
    }
    console.log(`\nBATCH DONE. Total spent: $${budget.spent.toFixed(3)}`);
  } else if (arg) {
    budget.cap = Infinity;
    await processPerson(arg);
    console.log(`\nDone. Total spent: $${budget.spent.toFixed(4)}`);
  } else {
    throw new Error('Usage: tsx catalog-kmdb-person-extract.ts "Full Name"  OR  --batch <usd_cap>');
  }
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
