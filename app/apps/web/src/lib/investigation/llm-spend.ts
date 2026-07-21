import 'server-only';
import { sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { maybeSendBudgetAlert } from '@korr/db/llm-budget-alert';

// 2026-07-19 — user report: real spend hit $1.21/day despite the (new,
// 2026-07-18) $1 gate in packages/db/src/llm.ts. Root cause found: THIS
// module is a second, independent daily-spend kill-switch that predates
// tonight's work — investigation-extract-claims.ts calls it directly,
// never through llmExtract(), so packages/db/src/llm.ts's gate never saw
// these calls at all. Worse, its ceiling defaulted to 50 000 HUF (~$130,
// LLM_DAILY_CEILING_HUF was never actually set on Vercel) — two orders of
// magnitude above what the user intends — and its query only summed the
// CURRENT model's own spend, not the combined total across every caller,
// so it couldn't even see packages/db/src/llm.ts's spend to begin with.
// Now reads the SAME LLM_DAILY_CEILING_USD as the other gate (single
// source of truth) and sums ALL models for the day, not just its own.
const HUF_PER_USD = 380; // approximate, matches packages/db/src/llm.ts

export type SpendProbe = {
  paused: boolean;
  currentSpendHuf: string;
  ceilingHuf: string;
};

/**
 * Read today's TOTAL DailyLlmUsage spend (all models, all callers) with
 * FOR UPDATE so a concurrent extraction can't race the kill-switch check
 * (FR-005, research.md §8). Returns a probe reflecting whether extraction
 * is paused for the rest of the day. The caller is responsible for opening
 * the transaction and committing within the same Postgres txn that writes
 * the extraction artefacts.
 */
export async function probeDailySpend(
  tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
  model: string,
): Promise<SpendProbe> {
  const ceilingUsd = Number(process.env.LLM_DAILY_CEILING_USD ?? '0.50');
  const ceiling = (ceilingUsd * HUF_PER_USD).toFixed(2);
  void model; // kept in the signature for the call site / logging; no longer used to scope the query
  const rows = (await tx.execute(sql`
    SELECT COALESCE(SUM("estimatedHufSpend"), 0)::text AS current
      FROM "DailyLlmUsage"
     WHERE day = (now() AT TIME ZONE 'Europe/Budapest')::date
     FOR UPDATE
  `)) as Array<{ current: string }>;
  const current = rows[0]?.current ?? '0';
  const paused = Number(current) >= Number(ceiling);
  if (paused) {
    // Ugyanaz a naponta-egyszeri Telegram-riasztás, mint packages/db/src/
    // llm.ts fő gate-jénél — LlmBudgetAlert(day) PRIMARY KEY-en dedupolva,
    // úgyhogy akármelyik gate veszi észre elsőként a napi limit elérését
    // (ez vagy a fő llmExtract() gate), csak egy üzenet megy ki naponta.
    await maybeSendBudgetAlert(tx, todayBudapestDate(), Number(current) / HUF_PER_USD, Number(ceiling) / HUF_PER_USD);
  }
  return { paused, currentSpendHuf: current, ceilingHuf: ceiling };
}

function todayBudapestDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
}

/**
 * Apply a post-call delta to `DailyLlmUsage` (upsert in one statement)
 * inside the same transaction that wrote the extraction artefacts.
 */
export async function recordDailySpend(
  tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
  model: string,
  inputTokens: number,
  outputTokens: number,
  estimatedHufSpend: string,
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO "DailyLlmUsage"
      (day, model, "inputTokens", "outputTokens", "estimatedHufSpend",
       "callCount", "firstCallAt", "lastCallAt")
    VALUES (
      (now() AT TIME ZONE 'Europe/Budapest')::date,
      ${model},
      ${inputTokens}::bigint,
      ${outputTokens}::bigint,
      ${estimatedHufSpend}::numeric,
      1,
      now(),
      now()
    )
    ON CONFLICT (day, model) DO UPDATE SET
      "inputTokens"       = "DailyLlmUsage"."inputTokens" + EXCLUDED."inputTokens",
      "outputTokens"      = "DailyLlmUsage"."outputTokens" + EXCLUDED."outputTokens",
      "estimatedHufSpend" = "DailyLlmUsage"."estimatedHufSpend" + EXCLUDED."estimatedHufSpend",
      "callCount"         = "DailyLlmUsage"."callCount" + 1,
      "firstCallAt"       = COALESCE("DailyLlmUsage"."firstCallAt", EXCLUDED."firstCallAt"),
      "lastCallAt"        = EXCLUDED."lastCallAt"
  `);
  void schema;
}

/**
 * Anthropic Haiku 4.5 pricing approximation in HUF (May 2026 cards):
 *   input  ≈ 1.00 USD per 1M tokens  → ~360 HUF / 1M tokens
 *   output ≈ 5.00 USD per 1M tokens  → ~1800 HUF / 1M tokens
 * Adjust if the env override `HAIKU_HUF_INPUT_PER_M` /
 * `HAIKU_HUF_OUTPUT_PER_M` is set.
 */
export function estimateHufSpend(
  inputTokens: number,
  outputTokens: number,
): string {
  const hufInputPerM = Number(
    process.env.HAIKU_HUF_INPUT_PER_M ?? '360',
  );
  const hufOutputPerM = Number(
    process.env.HAIKU_HUF_OUTPUT_PER_M ?? '1800',
  );
  const cost = (inputTokens / 1_000_000) * hufInputPerM
    + (outputTokens / 1_000_000) * hufOutputPerM;
  return cost.toFixed(2);
}
