import { NextResponse } from 'next/server';
import { gte, sql } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';
import type { LlmUsageRow, LlmUsageView } from '@korr/shared';

const DEFAULT_DAYS = 30;
const DEFAULT_CEILING = '50000';

export async function GET(req: Request) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const daysRaw = Number.parseInt(
    url.searchParams.get('days') ?? String(DEFAULT_DAYS),
    10,
  );
  const days = Math.max(7, Math.min(90, Number.isFinite(daysRaw) ? daysRaw : DEFAULT_DAYS));
  const ceilingHuf = process.env.LLM_DAILY_CEILING_HUF ?? DEFAULT_CEILING;

  const db = getDb();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceDay = since.toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(schema.dailyLlmUsage)
    .where(gte(schema.dailyLlmUsage.day, sinceDay));

  // Today's row across all models — if any model already breached the
  // ceiling, the operator-side banner shows the paused state (FR-005).
  const todayProbe = (await db.execute(sql`
    SELECT COALESCE(SUM("estimatedHufSpend"), 0)::text AS today
      FROM "DailyLlmUsage"
     WHERE day = (now() AT TIME ZONE 'Europe/Budapest')::date
  `)) as Array<{ today: string }>;
  const todaySpend = Number(todayProbe[0]?.today ?? '0');
  const extractionPaused = todaySpend >= Number(ceilingHuf);

  const items: LlmUsageRow[] = rows
    .sort((a, b) =>
      a.day < b.day ? 1 : a.day > b.day ? -1 : a.model.localeCompare(b.model),
    )
    .map((r) => ({
      day: r.day,
      model: r.model,
      inputTokens: r.inputTokens.toString(),
      outputTokens: r.outputTokens.toString(),
      estimatedHufSpend: r.estimatedHufSpend.toString(),
      callCount: r.callCount,
    }));

  const body: LlmUsageView = {
    ceilingHuf,
    rows: items,
    extractionPaused,
  };
  return NextResponse.json(body);
}
