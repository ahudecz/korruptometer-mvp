import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { sql } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { KPI_ROLLUP_LOCK } from '@korr/db/locks';
import { getDb, schema } from '@/lib/db';
import { inngest } from '@/inngest/client';

/**
 * /admin endpoint to force a KPI recompute. The hourly recompute and the
 * post-mutation recompute both run via the aggregate.kpi-rollup Inngest
 * function (T163). This route enqueues a kpi.recompute event so the same
 * code path runs, then optionally executes the rollup synchronously when
 * `?wait=1` is passed (handy for editors who want immediate feedback).
 *
 * The synchronous path holds pg_advisory_xact_lock(KPI_ROLLUP_LOCK) so it
 * still serialises against the Inngest function (FR-068).
 */
export async function POST(req: Request) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  await inngest.send({ name: 'kpi.recompute', data: { reason: 'admin-force' } });

  const url = new URL(req.url);
  if (url.searchParams.get('wait') !== '1') {
    return NextResponse.json({ ok: true, queued: true });
  }

  const db = getDb();

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${Number(KPI_ROLLUP_LOCK)})`);

    const total = await tx.execute<{
      total_damage: string;
      total_prison: number;
      active: number;
      indictments: number;
    }>(sql`
      SELECT
        COALESCE(SUM(amount), 0)::text          AS total_damage,
        COALESCE(SUM("sentenceYears"), 0)::int  AS total_prison,
        COUNT(*) FILTER (
          WHERE status IN ('Folyamatban','Vádemelés')
        )::int                                  AS active,
        COUNT(*) FILTER (WHERE status = 'Vádemelés')::int AS indictments
      FROM "Case"
    `);
    const row = (total as unknown as Array<{
      total_damage: string;
      total_prison: number;
      active: number;
      indictments: number;
    }>)[0]!;

    const sectorRows = await tx.execute<{ name: string; value: string }>(sql`
      SELECT sector::text AS name, SUM(amount)::text AS value
        FROM "Case"
       GROUP BY sector
       ORDER BY SUM(amount) DESC
    `);
    const bySector = (sectorRows as unknown as Array<{ name: string; value: string }>).map(
      (r) => ({ name: r.name, value: Number(r.value) }),
    );

    const partnerRows = await tx.execute<{ partner_count: number }>(
      sql`SELECT COUNT(*)::int AS partner_count FROM "Source" WHERE enabled = true`,
    );
    const partnerCount = Number(
      (partnerRows as unknown as Array<{ partner_count: number }>)[0]?.partner_count ?? 0,
    );

    await tx
      .insert(schema.kpiSnapshots)
      .values({
        id: 'singleton',
        computedAt: new Date(),
        totalDamage: BigInt(row.total_damage),
        totalPrisonYears: row.total_prison,
        activeCases: row.active,
        newIndictmentsThisWeek: row.indictments,
        partnerCount,
        bySector,
      })
      .onConflictDoUpdate({
        target: schema.kpiSnapshots.id,
        set: {
          computedAt: new Date(),
          totalDamage: BigInt(row.total_damage),
          totalPrisonYears: row.total_prison,
          activeCases: row.active,
          newIndictmentsThisWeek: row.indictments,
          partnerCount,
          bySector,
        },
      });
  });

  revalidateTag('stats');
  return NextResponse.json({ ok: true });
}
