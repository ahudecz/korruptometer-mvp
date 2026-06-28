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
  return (process.env.LLM_PROVIDER ?? 'langdock').toLowerCase();
}

function defaultModel(): string {
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL;
  return provider() === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gemini-2.5-flash';
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
  if (provider() === 'anthropic') {
    return anthropicExtract<T>(opts, model, maxTokens);
  }
  return openaiCompatExtract<T>(opts, model, maxTokens);
}

// ─── OpenAI-compatible path (LangDock: Gemini / Claude / GPT / Mistral) ───────

async function openaiCompatExtract<T>(
  opts: { system: string; user: string; tool: LlmToolSpec },
  model: string,
  maxTokens: number,
): Promise<LlmResult<T>> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY not set');
  const baseUrl = process.env.LLM_BASE_URL ?? DEFAULT_LANGDOCK_URL;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
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
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
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
