/**
 * Slice 10 — LLM tighten-up of K-Monitor person candidates.
 *
 * Reads approved KMonitorPersonCandidate rows whose llmCheckedAt is null,
 * fetches the kmdb_base article text for each candidate's sampleArticles,
 * asks Anthropic Haiku 4.5 with structured-output whether the person is
 * alleged to have misappropriated a HUF amount, and writes the cleaned
 * result back to llmAmountHuf / llmConfidence / llmEvidence / llmCheckedAt.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @korr/db kmdb:llm-tighten
 *
 * Env:
 *   ANTHROPIC_API_KEY  required
 *   KMDB_LLM_LIMIT     optional, cap on how many candidates to process per run
 *   KMDB_LLM_MODEL     optional, defaults to claude-haiku-4-5
 *   HF_DATASET_BASE    optional, defaults to https://datasets-server.huggingface.co
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env') });

import Anthropic from '@anthropic-ai/sdk';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

const MODEL = process.env.KMDB_LLM_MODEL ?? 'claude-haiku-4-5';
const LIMIT = Number.parseInt(process.env.KMDB_LLM_LIMIT ?? '50', 10);
const HF_BASE = process.env.HF_DATASET_BASE ?? 'https://datasets-server.huggingface.co';

type SampleArticle = { newsId: number; sourceUrl: string; title: string };

type LlmAnswer = {
  amountHuf: number | null;
  confidence: number; // 0..1
  evidence: string;
};

async function fetchArticleText(newsId: number): Promise<{ title: string; text: string } | null> {
  const url =
    `${HF_BASE}/filter` +
    `?dataset=K-Monitor/kmdb_base&config=default&split=train` +
    `&where=news_id%3D${encodeURIComponent(String(newsId))}` +
    `&offset=0&length=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      rows?: { row: { title?: string; text?: string } }[];
    };
    const row = json.rows?.[0]?.row;
    if (!row) return null;
    return { title: row.title ?? '', text: row.text ?? '' };
  } catch {
    return null;
  }
}

async function classifyPerson(
  client: Anthropic,
  displayName: string,
  articles: { title: string; text: string }[],
): Promise<LlmAnswer | null> {
  // Trim each article so the request stays well under context budget.
  const trimmed = articles
    .map((a, i) => `### Cikk ${i + 1}: ${a.title}\n${a.text.slice(0, 6_000)}`)
    .join('\n\n');

  const system =
    'You are extracting financial-exposure figures for a Hungarian corruption tracker. ' +
    'For one named subject, decide whether the supplied articles ALLEGE that this person ' +
    'personally misappropriated/embezzled/diverted a monetary amount (vs. simply being ' +
    'mentioned in articles where amounts appear). Return strict JSON only.';

  const user = `Subject (Hungarian-name): ${displayName}

Articles (Hungarian press, K-Monitor curated):
${trimmed}

Return ONLY a JSON object with this shape (no markdown, no prose):
{
  "amountHuf": number_or_null,
  "confidence": 0_to_1,
  "evidence": "one-short-sentence quote/justification from the articles, Hungarian or English"
}

Rules:
- amountHuf is the BEST single HUF figure the articles attribute to this person's alleged conduct.
  Convert EUR/USD into HUF at 1 EUR = 400 HUF, 1 USD = 360 HUF.
  Use null if the articles only mention the person tangentially or if no amount is attributed.
- confidence reflects how directly the articles attribute the amount to THIS person specifically.
- evidence is a single short sentence — quote the article if possible.`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = res.content[0];
  if (!block || block.type !== 'text') return null;
  const text = block.text.trim();
  // Strip code fences if present.
  const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(cleaned) as LlmAnswer;
    return {
      amountHuf:
        typeof parsed.amountHuf === 'number' && Number.isFinite(parsed.amountHuf)
          ? parsed.amountHuf
          : null,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0))),
      evidence: String(parsed.evidence ?? '').slice(0, 500),
    };
  } catch {
    return null;
  }
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');

  const client = new Anthropic({ apiKey });
  const conn = postgres(dbUrl, { prepare: false, max: 1 });
  const db = drizzle(conn, { schema });

  const candidates = await db
    .select()
    .from(schema.kMonitorPersonCandidates)
    .where(
      and(
        eq(schema.kMonitorPersonCandidates.approvalState, 'approved'),
        isNull(schema.kMonitorPersonCandidates.llmCheckedAt),
      ),
    )
    .limit(LIMIT);

  console.log(`[llm-tighten] ${candidates.length} approved candidate(s) need LLM check`);

  for (const c of candidates) {
    const samples = (c.sampleArticles ?? []) as SampleArticle[];
    if (!Array.isArray(samples) || samples.length === 0) {
      console.log(`[llm-tighten] ${c.displayName}: no sample articles — skipping`);
      continue;
    }
    const fetched: { title: string; text: string }[] = [];
    for (const s of samples.slice(0, 5)) {
      const art = await fetchArticleText(s.newsId);
      if (art && art.text) fetched.push(art);
    }
    if (fetched.length === 0) {
      console.log(`[llm-tighten] ${c.displayName}: no article text retrieved — skipping`);
      continue;
    }

    const answer = await classifyPerson(client, c.displayName, fetched);
    if (!answer) {
      console.log(`[llm-tighten] ${c.displayName}: LLM returned unparseable response`);
      continue;
    }

    await db
      .update(schema.kMonitorPersonCandidates)
      .set({
        llmAmountHuf: answer.amountHuf == null ? null : BigInt(Math.round(answer.amountHuf)),
        llmConfidence: Math.round(answer.confidence * 100),
        llmEvidence: answer.evidence,
        llmCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.kMonitorPersonCandidates.id, c.id));

    const huf = answer.amountHuf == null ? '—' : new Intl.NumberFormat('hu-HU').format(answer.amountHuf);
    console.log(
      `[llm-tighten] ${c.displayName} → ${huf} HUF (conf ${Math.round(answer.confidence * 100)}%)`,
    );
  }

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
