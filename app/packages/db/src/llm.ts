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
// Known limitation: the check-then-call-then-record sequence isn't atomic —
// a burst of truly concurrent calls can each pass the check before any of
// them records usage, so a small overshoot past the ceiling is possible
// under concurrency. This is a real backstop, not a mathematically perfect
// one; see memory/feedback for the follow-up if tighter enforcement is
// needed (e.g. a Postgres advisory lock around the check+record).

const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-6@default': { input: 3.0, output: 15.0 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gpt-5-chat-latest': { input: 1.25, output: 10.0 },
};
// Unknown model → assume the expensive end (Sonnet-tier) so an unrecognised
// model can never silently bypass the ceiling by under-counting its cost.
const FALLBACK_PRICING = { input: 3.0, output: 15.0 };
const HUF_PER_USD = 380; // approximate — only feeds the existing HUF display column, not the gate's own math.

function modelCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING_USD_PER_MTOK[model] ?? FALLBACK_PRICING;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

/** Europe/Budapest calendar day, matching the admin llm-usage route's boundary. */
function todayBudapest(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
}

async function todaySpendUsd(): Promise<number> {
  const rows = await db().select().from(dailyLlmUsage).where(eq(dailyLlmUsage.day, todayBudapest()));
  return rows.reduce((sum, r) => sum + modelCostUsd(r.model, Number(r.inputTokens), Number(r.outputTokens)), 0);
}

async function recordUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  if (inputTokens === 0 && outputTokens === 0) return;
  const day = todayBudapest();
  const usd = modelCostUsd(model, inputTokens, outputTokens);
  const huf = (usd * HUF_PER_USD).toFixed(2);
  try {
    await db()
      .insert(dailyLlmUsage)
      .values({
        day,
        model,
        inputTokens: BigInt(inputTokens),
        outputTokens: BigInt(outputTokens),
        estimatedHufSpend: huf,
        callCount: 1,
        firstCallAt: new Date(),
        lastCallAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [dailyLlmUsage.day, dailyLlmUsage.model],
        set: {
          inputTokens: sql`${dailyLlmUsage.inputTokens} + ${BigInt(inputTokens)}`,
          outputTokens: sql`${dailyLlmUsage.outputTokens} + ${BigInt(outputTokens)}`,
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

  const ceilingUsd = Number(process.env.LLM_DAILY_CEILING_USD ?? '1.00');
  if (ceilingUsd > 0) {
    try {
      const spent = await todaySpendUsd();
      if (spent >= ceilingUsd) {
        console.error(`[llm-budget] daily ceiling reached ($${spent.toFixed(2)} >= $${ceilingUsd.toFixed(2)}) — refusing call, will retry next run.`);
        return { data: null, inputTokens: 0, outputTokens: 0 };
      }
    } catch (err) {
      // Fail CLOSED: if we can't verify today's spend, don't spend more.
      console.error('[llm-budget] failed to check daily spend — refusing call (fail-closed):', err);
      return { data: null, inputTokens: 0, outputTokens: 0 };
    }
  }

  const result =
    provider() === 'anthropic'
      ? await anthropicExtract<T>(opts, model, maxTokens)
      : await openaiCompatExtract<T>(opts, model, maxTokens);

  await recordUsage(model, result.inputTokens, result.outputTokens);
  return result;
}

// ─── OpenAI-compatible path (LangDock: Gemini / Claude / GPT / Mistral) ───────

async function openaiCompatExtract<T>(
  opts: { system: string; user: string; tool: LlmToolSpec },
  model: string,
  maxTokens: number,
): Promise<LlmResult<T>> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    console.error('[llm] LLM_API_KEY is not set — detection pipeline is silently disabled. Set LLM_API_KEY (LangDock) or switch to LLM_PROVIDER=anthropic on Vercel.');
    return { data: null, inputTokens: 0, outputTokens: 0 };
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
      return { data: null, inputTokens: 0, outputTokens: 0 };
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
        return { data: JSON.parse(args) as T, inputTokens, outputTokens };
      } catch {
        /* fall through to content parsing */
      }
    }
    // Fallback: some providers return the JSON object as plain content.
    if (message?.content) {
      const cleaned = stripCodeFence(message.content);
      try {
        return { data: JSON.parse(cleaned) as T, inputTokens, outputTokens };
      } catch {
        /* no parseable JSON */
      }
    }
    return { data: null, inputTokens, outputTokens };
  } catch (err) {
    console.error(`[llm] ${model} request failed:`, err instanceof Error ? err.message : err);
    return { data: null, inputTokens: 0, outputTokens: 0 };
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
): Promise<LlmResult<T>> {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('[llm] ANTHROPIC_API_KEY is not set — detection pipeline is silently disabled.');
      return { data: null, inputTokens: 0, outputTokens: 0 };
    }
    _anthropic = new Anthropic({ apiKey });
  }
  try {
    const response = await _anthropic.messages.create({
      model,
      max_tokens: maxTokens,
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
    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return { data: null, inputTokens, outputTokens };
    }
    return { data: toolUse.input as T, inputTokens, outputTokens };
  } catch (err) {
    console.error(`[llm] anthropic ${model} failed:`, err instanceof Error ? err.message : err);
    return { data: null, inputTokens: 0, outputTokens: 0 };
  }
}
