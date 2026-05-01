import 'server-only';
import { revalidateTag } from 'next/cache';
import { sql } from 'drizzle-orm';

import { KPI_ROLLUP_LOCK_INT } from '@korr/db/locks';
import { getDb, schema } from '@/lib/db';

import { inngest } from '../client';

/**
 * aggregate.kpi-rollup (T163) — recomputes the singleton KpiSnapshot row
 * via SQL aggregates, then revalidates the `stats` cache tag so /api/stats
 * serves the fresh value on the next request.
 *
 * Triggers:
 *   - hourly cron `0 * * * *`
 *   - kpi.recompute event from admin mutation routes (debounced ≤1×/10s
 *     via Inngest event-key collapsing — same `kpi-recompute` key in a 10s
 *     window collapses to a single run).
 *
 * Concurrency is forced to 1 *and* we hold pg_advisory_xact_lock so two
 * runs that race past Inngest's collapse still serialise at the database.
 */
export const aggregateKpiRollup = inngest.createFunction(
  {
    id: 'aggregate-kpi-rollup',
    name: 'Aggregate / KPI rollup',
    concurrency: { limit: 1 },
    debounce: { period: '10s', key: 'kpi-recompute' },
  },
  [{ cron: '0 * * * *' }, { event: 'kpi.recompute' }],
  async ({ step }) => {
    const db = getDb();

    await step.run('rollup', async () => {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${KPI_ROLLUP_LOCK_INT})`);

        const totals = await tx.execute<{
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
            COUNT(*) FILTER (
              WHERE status = 'Vádemelés'
                AND "createdAt" >= now() - interval '7 days'
            )::int                                  AS indictments
          FROM "Case"
        `);
        const row = (totals as unknown as Array<{
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
    });

    await step.run('revalidate-stats', async () => {
      revalidateTag('stats');
    });

    return { ok: true };
  },
);
