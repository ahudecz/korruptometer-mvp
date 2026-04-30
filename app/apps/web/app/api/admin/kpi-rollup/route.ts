import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { sql } from 'drizzle-orm';

import { requireEditor } from '@/lib/admin/auth';
import { KPI_ROLLUP_LOCK } from '@korr/db/locks';
import { getDb, schema } from '@/lib/db';

/**
 * Synchronous wrapper for aggregate.kpi-rollup (T163). Phase 3 will trigger
 * this through Inngest hourly + on every approve/reject/duplicate; here it
 * is invokable from /admin so editors can force a recompute.
 *
 * Holds pg_advisory_xact_lock(KPI_ROLLUP_LOCK) so concurrent invocations
 * serialise (FR-068).
 */
export async function POST() {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
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
