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
 *     per-function — Inngest collapses repeated triggers within the
 *     window into a single run).
 *
 * Concurrency is forced to 1 *and* we hold pg_advisory_xact_lock so two
 * runs that race past Inngest's collapse still serialise at the database.
 */
export const aggregateKpiRollup = inngest.createFunction(
  {
    id: 'aggregate-kpi-rollup',
    name: 'Aggregate / KPI rollup',
    concurrency: { limit: 1 },
    debounce: { period: '10s' },
  },
  [{ cron: '0 * * * *' }, { event: 'kpi.recompute' }],
  async ({ step, logger }) => {
    const db = getDb();

    await step.run('rollup', async () => {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${KPI_ROLLUP_LOCK_INT})`);

        // Sentence / status KPIs still come from the curated Case table.
        const totals = await tx.execute<{
          total_prison: number;
          active: number;
          indictments: number;
        }>(sql`
          SELECT
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
          total_prison: number;
          active: number;
          indictments: number;
        }>)[0]!;

        // Damage figures come from the real grouped scandal catalog — the same
        // source the public ADATBÁZIS lists. ScandalCatalog.damage_huf is the
        // MAX member estimate per scandal (already de-double-counted), so a plain
        // SUM across scandals is the correct cross-scandal total.
        const damageRows = await tx.execute<{ total_damage: string }>(sql`
          SELECT COALESCE(SUM(damage_huf), 0)::text AS total_damage
            FROM "ScandalCatalog"
        `);
        const totalDamage = BigInt(
          (damageRows as unknown as Array<{ total_damage: string }>)[0]?.total_damage ?? '0',
        );

        // Donut: damage breakdown by sector (Case.sector enum), stored in
        // the `bySector` jsonb slot ({name,value}[]). All 6 enum values are
        // natural labels so no "Egyéb" remainder bucket is needed.
        // sector::text ensures postgres-js receives a text OID (not the custom
        // enum OID) so the value is always returned as a plain JS string.
        const sectorRows = await tx.execute<{ name: string; value: string }>(sql`
          SELECT sector::text            AS name,
                 SUM(amount)::text       AS value
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
            totalDamage,
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
              totalDamage,
              totalPrisonYears: row.total_prison,
              activeCases: row.active,
              newIndictmentsThisWeek: row.indictments,
              partnerCount,
              bySector,
            },
          });
      });
    });

    await step.run('refresh-scandal-catalog', async () => {
      const db = getDb();
      // Refresh the materialized view (0030 + 0037 migrations) so homepage reads
      // instant data. CONCURRENTLY needs the unique index added in 0037 — before
      // that this call failed on every single run and a bare catch{} swallowed
      // it silently, so the view never actually refreshed. Now logged instead of
      // hidden, so a future regression (e.g. the unique index getting dropped)
      // is visible in Inngest run logs rather than silently no-op'ing forever.
      try {
        await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY "ScandalCatalog"`);
      } catch (err) {
        logger?.warn?.(`refresh-scandal-catalog failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    await step.run('revalidate-stats', async () => {
      revalidateTag('stats');
    });

    return { ok: true };
  },
);
