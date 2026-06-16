import 'server-only';
import { sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

const DEFAULT_CEILING_HUF = '50000';

export type SpendProbe = {
  paused: boolean;
  currentSpendHuf: string;
  ceilingHuf: string;
};

/**
 * Read today's per-model row in `DailyLlmUsage` with FOR UPDATE so a
 * concurrent extraction can't race the kill-switch check (FR-005,
 * research.md §8). Returns a probe reflecting whether the model is paused
 * for the rest of the day. The caller is responsible for opening the
 * transaction and committing within the same Postgres txn that writes the
 * extraction artefacts.
 */
export async function probeDailySpend(
  tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
  model: string,
): Promise<SpendProbe> {
  const ceiling = process.env.LLM_DAILY_CEILING_HUF ?? DEFAULT_CEILING_HUF;
  // FOR UPDATE on the day's row (Postgres only locks the row if it
  // exists; the upsert below races safely because the unique constraint
  // is enforced atomically).
  const rows = (await tx.execute(sql`
    SELECT "estimatedHufSpend"::text AS current
      FROM "DailyLlmUsage"
     WHERE day = (now() AT TIME ZONE 'Europe/Budapest')::date
       AND model = ${model}
     FOR UPDATE
  `)) as Array<{ current: string }>;
  const current = rows[0]?.current ?? '0';
  const paused = Number(current) >= Number(ceiling);
  return { paused, currentSpendHuf: current, ceilingHuf: ceiling };
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
