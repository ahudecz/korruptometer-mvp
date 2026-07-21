/**
 * Switchable LLM layer for the detection pipeline.
 *
 * One env var picks the provider; the model is a second env var, so swapping
 * between Gemini and Claude (both served by LangDock's OpenAI-compatible
 * endpoint) is a single-setting change — no code edit.
 *
 *   LLM_PROVIDER   "langdock" (default, OpenAI-compatible) | "anthropic" (direct Claude SDK)
 *   LLM_BASE_URL   default "https://api.langdock.com/openai/eu/v1"
 *   LLM_API_KEY    LangDock API key (Completion API scope)
 *   LLM_MODEL      default "gemini-2.5-flash" — switch to "claude-sonnet-4-6@default" any time
 *   ANTHROPIC_API_KEY  only used when LLM_PROVIDER=anthropic
 *
 * All detectors call `llmExtract` with a JSON-schema tool; the model is forced
 * to return arguments matching that schema (function calling).
 */
import Anthropic from '@anthropic-ai/sdk';
import { eq, sql } from 'drizzle-orm';

import { db } from './index';
import { dailyLlmUsage } from './schema';
import { maybeSendBudgetAlert } from './llm-budget-alert';

// ── 2026-07-18 — hard daily spend gate ──────────────────────────────────────
// User report: $28.51 spent month-to-date, all Claude Haiku 4.5, climbing
// from ~$0.5/day to ~$6/day over two weeks — with NO enforced cap anywhere.
// The DailyLlmUsage table + LLM_DAILY_CEILING_HUF env var already existed
// (api/admin/investigations/llm-usage/route.ts reads them) but NOTHING ever
// wrote to the table and NOTHING ever refused a call on it — dead
// infrastructure. This wires up the real thing: every llmExtract() call now
// checks today's actual cumulative USD spend (computed straight from
// recorded token counts, independent of the HUF column) BEFORE calling out,
// and refuses the call once the ceiling is hit.
//
// A refused call returns { data: null, inputTokens: 0, outputTokens: 0 } —
// exactly what isTransientLlmFailure() (detection-check.ts) already treats
// as "transient, retry later, don't markChecked()". No caller needed to
// change: every detector already degrades gracefully on this shape.
//
// Fails CLOSED on a DB read error (refuses the call rather than risking an
// unbounded spend) — the opposite tradeoff from most of this codebase's
// "fail open on DB hiccup" pattern, deliberately, because tonight's problem
// was unbounded spend, not pipeline availability.
//
// 2026-07-21 — user report: daily total landed at $1.0008, a hair over the
// $1.00 ceiling. Root cause: the check→call→record sequence used to run as
// three separate, unlocked steps — two truly concurrent llmExtract() calls
// (e.g. scrape-news's classify and a detector firing in the same cron
// minute) could each read "today's spend" before EITHER had recorded its
// own cost, so both would pass the ceiling check even though, together,
// they push the total over it. Fixed: the whole sequence now runs inside
// one Postgres-advisory-locked transaction (pg_advisory_xact_lock, keyed to
// the Budapest calendar day) — every llmExtract() call fully resolves
// (check, provider call, record) before the next one is even allowed to
// read today's spend. This serialises LLM calls process-wide, which is a
// non-issue at this volume (a few hundred calls/day) and each detector
// already runs at Inngest concurrency:1 individually — the lock only ever
// queues calls from DIFFERENT jobs that happen to land in the same minute.

const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-6@default': { input: 3.0, output: 15.0 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gpt-5-chat-latest': { input: 1.25, output: 10.0 },
};
// Unknown model → assume the expensive end (Sonnet-tier) so an unrecognised
// model can never silently bypass the ceiling by under-counting its cost.
const FALLBACK_PRICING = { input: 3.0, output: 15.0 };
// 2026-07-20 — approximate. Used both ways now: recordUsage() converts a
// freshly-computed USD cost to HUF for the persisted ledger column, and
// todaySpendUsd() converts that same ledger's HUF sum back to USD for the
// ceiling comparison — so this constant IS part of the gate's math now
// (it wasn't before the ledger became the gate's read source, see below).
const HUF_PER_USD = 380;

// 2026-07-20 — Anthropic's standard prompt-cache multipliers, fixed
// fractions of the model's own base INPUT rate (same ratio across every
// Claude model, not a separate per-model price): writing a new cache entry
// costs 1.25x base input; reading a hit costs 0.1x. These are NOT reflected
// in `response.usage.input_tokens` — the API reports them in their own
// `cache_creation_input_tokens` / `cache_read_input_tokens` fields. Ignoring
// them here would silently under-count real spend (and under-feed the daily
// ceiling gate) the moment caching is turned on below — the exact class of
// bug this file exists to prevent.
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

type UsageBreakdown = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
};

function modelCostUsd(model: string, u: UsageBreakdown): number {
  const p = PRICING_USD_PER_MTOK[model] ?? FALLBACK_PRICING;
  return (
    (u.inputTokens / 1_000_000) * p.input
    + (u.outputTokens / 1_000_000) * p.output
    + (u.cacheCreationTokens / 1_000_000) * p.input * CACHE_WRITE_MULTIPLIER
    + (u.cacheReadTokens / 1_000_000) * p.input * CACHE_READ_MULTIPLIER
  );
}

/** Europe/Budapest calendar day, matching the admin llm-usage route's boundary. */
function todayBudapest(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
}

type Tx = Parameters<Parameters<ReturnType<typeof db>['transaction']>[0]>[0];

/**
 * 2026-07-20 — reads the ALREADY-COMPUTED `estimatedHufSpend` ledger sum
 * instead of recomputing cost from raw inputTokens/outputTokens columns (the
 * old approach). Those two columns no longer capture the full cost picture
 * once cache tokens exist — recomputing from just them would under-count
 * exactly like recordUsage would without the fix below. The persisted HUF
 * total is the single source of truth for what was actually spent.
 *
 * 2026-07-21 — takes the active transaction (tx), not a fresh `db()` call,
 * so this read happens under the same advisory lock llmExtract() holds for
 * the whole check→call→record sequence. See the lock comment above.
 */
async function todaySpendUsd(tx: Tx): Promise<number> {
  const rows = await tx
    .select({ estimatedHufSpend: dailyLlmUsage.estimatedHufSpend })
    .from(dailyLlmUsage)
    .where(eq(dailyLlmUsage.day, todayBudapest()));
  const totalHuf = rows.reduce((sum, r) => sum + Number(r.estimatedHufSpend), 0);
  return totalHuf / HUF_PER_USD;
}

async function recordUsage(tx: Tx, model: string, u: UsageBreakdown): Promise<void> {
  if (u.inputTokens === 0 && u.outputTokens === 0 && u.cacheCreationTokens === 0 && u.cacheReadTokens === 0) return;
  const day = todayBudapest();
  const usd = modelCostUsd(model, u);
  const huf = (usd * HUF_PER_USD).toFixed(2);
  try {
    await tx
      .insert(dailyLlmUsage)
      .values({
        day,
        model,
        inputTokens: BigInt(u.inputTokens),
        outputTokens: BigInt(u.outputTokens),
        estimatedHufSpend: huf,
        callCount: 1,
        firstCallAt: new Date(),
        lastCallAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [dailyLlmUsage.day, dailyLlmUsage.model],
        set: {
          inputTokens: sql`${dailyLlmUsage.inputTokens} + ${BigInt(u.inputTokens)}`,
          outputTokens: sql`${dailyLlmUsage.outputTokens} + ${BigInt(u.outputTokens)}`,
          estimatedHufSpend: sql`${dailyLlmUsage.estimatedHufSpend} + ${huf}`,
          callCount: sql`${dailyLlmUsage.callCount} + 1`,
          lastCallAt: new Date(),
        },
      });
  } catch (err) {
    // Recording failure must never crash the caller — the LLM call already
    // happened, the money is already spent, losing the ledger entry is a
    // (logged) accounting gap, not grounds to fail the detector.
    console.error('[llm-budget] failed to record usage (non-fatal):', err);
  }
}

export type LlmToolSpec = {
  name: string;
  description: string;
  /** JSON Schema for the tool parameters (same object used by both providers). */
  schema: Record<string, unknown>;
};

export type LlmResult<T> = {
  data: T | null;
  inputTokens: number;
  outputTokens: number;
};

const DEFAULT_LANGDOCK_URL = 'https://api.langdock.com/openai/eu/v1';

function provider(): string {
  // Default changed from 'langdock' to 'anthropic' (2026-07-11) — the
  // LangDock workspace hit its €0.00 monthly spending limit, silently
  // failing every LLM call for any environment that doesn't explicitly set
  // LLM_PROVIDER. Vercel prod already sets LLM_PROVIDER explicitly; this
  // default just keeps local/dev/scripts consistent with prod instead of
  // quietly hitting the dead LangDock key.
  return (process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase();
}

function defaultModel(): string {
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL;
  // gpt-5-chat-latest = non-reasoning chat model available on the LangDock key.
  // (Avoid reasoning models like gpt-5-mini/o3 here — they burn the token budget
  // on hidden reasoning and return no tool call.) Switch via LLM_MODEL.
  return provider() === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-5-chat-latest';
}

export async function llmExtract<T>(opts: {
  system: string;
  user: string;
  tool: LlmToolSpec;
  maxTokens?: number;
  /** Per-call model override; otherwise LLM_MODEL / provider default. */
  model?: string;
}): Promise<LlmResult<T>> {
  const maxTokens = opts.maxTokens ?? 512;
  const model = opts.model ?? defaultModel();
  const ceilingUsd = Number(process.env.LLM_DAILY_CEILING_USD ?? '0.50');

  if (ceilingUsd <= 0) {
    // Gate disabled — no lock needed, just call straight through.
    const result =
      provider() === 'anthropic'
        ? await anthropicExtract<T>(opts, model, maxTokens)
        : await openaiCompatExtract<T>(opts, model, maxTokens);
    await db().transaction((tx) =>
      recordUsage(tx, model, {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cacheCreationTokens: result.cacheCreationTokens,
        cacheReadTokens: result.cacheReadTokens,
      }),
    );
    return { data: result.data, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  try {
    return await db().transaction(async (tx) => {
      // Advisory lock keyed to the Budapest calendar day — held for the
      // full check→call→record sequence below, so no second call can even
      // read "today's spend" until this one has either refused or fully
      // recorded its own cost. See the file-header comment for why.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('llm_daily_budget'), hashtext(${todayBudapest()}))`);

      const spent = await todaySpendUsd(tx);
      if (spent >= ceilingUsd) {
        console.error(`[llm-budget] daily ceiling reached ($${spent.toFixed(2)} >= $${ceilingUsd.toFixed(2)}) — refusing call, will retry next run.`);
        await maybeSendBudgetAlert(tx, todayBudapest(), spent, ceilingUsd);
        return { data: null, inputTokens: 0, outputTokens: 0 };
      }

      const result =
        provider() === 'anthropic'
          ? await anthropicExtract<T>(opts, model, maxTokens)
          : await openaiCompatExtract<T>(opts, model, maxTokens);

      await recordUsage(tx, model, {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cacheCreationTokens: result.cacheCreationTokens,
        cacheReadTokens: result.cacheReadTokens,
      });
      return { data: result.data, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
    });
  } catch (err) {
    // Fail CLOSED: if the locked check/record transaction itself fails
    // (DB hiccup, lock timeout), refuse the call rather than risk spending
    // with no ledger entry — the opposite tradeoff from this codebase's
    // usual "fail open on DB hiccup" pattern, deliberately, because the
    // problem this file exists to prevent is unbounded spend, not
    // pipeline availability.
    console.error('[llm-budget] locked budget check/record failed — refusing call (fail-closed):', err);
    return { data: null, inputTokens: 0, outputTokens: 0 };
  }
}

type ProviderResult<T> = LlmResult<T> & { cacheCreationTokens: number; cacheReadTokens: number };

// ─── OpenAI-compatible path (LangDock: Gemini / Claude / GPT / Mistral) ───────
// No prompt-caching support in this path (LangDock's OpenAI-compat endpoint
// doesn't expose it the way Anthropic's native API does) — cache fields are
// always 0 here, real or not, so the shared cost math in llmExtract() never
// has to special-case the provider.

async function openaiCompatExtract<T>(
  opts: { system: string; user: string; tool: LlmToolSpec },
  model: string,
  maxTokens: number,
): Promise<ProviderResult<T>> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    console.error('[llm] LLM_API_KEY is not set — detection pipeline is silently disabled. Set LLM_API_KEY (LangDock) or switch to LLM_PROVIDER=anthropic on Vercel.');
    return { data: null, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };
  }
  const baseUrl = process.env.LLM_BASE_URL ?? DEFAULT_LANGDOCK_URL;

  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 30000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: opts.tool.name,
              description: opts.tool.description,
              parameters: opts.tool.schema,
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: opts.tool.name } },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[llm] ${model} HTTP ${res.status}: ${body.slice(0, 300)}`);
      return { data: null, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };
    }

    const json = (await res.json()) as {
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{ function?: { arguments?: string } }>;
        };
      }>;
    };

    const inputTokens = json.usage?.prompt_tokens ?? 0;
    const outputTokens = json.usage?.completion_tokens ?? 0;
    const message = json.choices?.[0]?.message;

    // Preferred: structured function-call arguments.
    const args = message?.tool_calls?.[0]?.function?.arguments;
    if (args) {
      try {
        return { data: JSON.parse(args) as T, inputTokens, outputTokens, cacheCreationTokens: 0, cacheReadTokens: 0 };
      } catch {
        /* fall through to content parsing */
      }
    }
    // Fallback: some providers return the JSON object as plain content.
    if (message?.content) {
      const cleaned = stripCodeFence(message.content);
      try {
        return { data: JSON.parse(cleaned) as T, inputTokens, outputTokens, cacheCreationTokens: 0, cacheReadTokens: 0 };
      } catch {
        /* no parseable JSON */
      }
    }
    return { data: null, inputTokens, outputTokens, cacheCreationTokens: 0, cacheReadTokens: 0 };
  } catch (err) {
    console.error(`[llm] ${model} request failed:`, err instanceof Error ? err.message : err);
    return { data: null, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };
  } finally {
    clearTimeout(timer);
  }
}

function stripCodeFence(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

// ─── Direct Anthropic path (LLM_PROVIDER=anthropic) ───────────────────────────

let _anthropic: Anthropic | null = null;

async function anthropicExtract<T>(
  opts: { system: string; user: string; tool: LlmToolSpec },
  model: string,
  maxTokens: number,
): Promise<ProviderResult<T>> {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('[llm] ANTHROPIC_API_KEY is not set — detection pipeline is silently disabled.');
      return { data: null, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };
    }
    _anthropic = new Anthropic({ apiKey });
  }
  try {
    const response = await _anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      // 2026-07-21 — a 2026-07-20-i cache_control marker itt SZÁNDÉKOSAN
      // nincs többé: lemértem client.messages.countTokens()-szel, az
      // ai-classify system+tool sémája ~1224 token — a Haiku 4.5 minimum
      // cache-elhető prefixe 4096 token (l. Anthropic docs), tehát a marker
      // sose ért el semmit (cache_creation_input_tokens mindig 0 volt,
      // megerősítve a platform.claude.com/usage/cache oldalon is: "You're
      // not using prompt caching"). A 07-20-i mért "felezés" nem a cache-től
      // jött, hanem ugyanaznapi más fixektől (fail-closed classify-hiba
      // kezelés). Ha valaha megint felmerül a caching ötlete: előbb
      // countTokens()-szel ellenőrizd, hogy a prefix eléri-e a 4096 tokent
      // — jelen rövid, egyedi klasszifikáló promptokon nem fogja.
      system: opts.system,
      tools: [
        {
          name: opts.tool.name,
          description: opts.tool.description,
          input_schema: opts.tool.schema as Anthropic.Tool['input_schema'],
        },
      ],
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: opts.user }],
    });
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const cacheCreationTokens = response.usage?.cache_creation_input_tokens ?? 0;
    const cacheReadTokens = response.usage?.cache_read_input_tokens ?? 0;
    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return { data: null, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens };
    }
    return { data: toolUse.input as T, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens };
  } catch (err) {
    console.error(`[llm] anthropic ${model} failed:`, err instanceof Error ? err.message : err);
    return { data: null, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };
  }
}
