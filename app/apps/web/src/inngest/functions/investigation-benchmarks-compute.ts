import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import {
  DIMENSIONS,
  cohortHash,
  computeCohort,
  specForDimension,
} from '@/lib/investigation/benchmarks';
import { completeJob, failJob, startJob } from '@/lib/investigation/job-state';
import { inngest } from '../client';

/**
 * investigation.benchmarks-compute (T055, FR-017/FR-018).
 *
 * Triggered by `investigation.xref.source.completed`. Recomputes every
 * dimension's cohort (across ALL benchmark-relevance records, not just
 * the ones tied to this investigation) and upserts the per-cohort
 * Benchmark row. Emits `investigation.benchmarks.computed` (with
 * dimensionsComputed=[] when nothing applies — fan-in for the scorer).
 */
export const investigationBenchmarksCompute = inngest.createFunction(
  {
    id: 'investigation.benchmarks-compute',
    concurrency: [{ key: 'event.data.investigationId', limit: 1 }],
    retries: 3,
  },
  { event: 'investigation.xref.source.completed' },
  async ({ event, step }) => {
    const { investigationId } = event.data;
    Sentry.addBreadcrumb({
      category: 'investigation.benchmarks',
      message: 'start',
      data: { investigationId },
    });

    await step.run('mark-running', async () => {
      await startJob({ investigationId, jobKind: 'benchmarks' });
    });

    let result: Array<{ dimension: string; n: number }>;
    try {
    result = await step.run('compute', async () => {
      const db = getDb();
      const computed: Array<{ dimension: string; n: number }> = [];
      for (const dim of DIMENSIONS) {
        const cohort = await computeCohort(dim);
        if (!cohort) continue;
        await db.execute(sql`
          INSERT INTO "Benchmark" (
            "cohortHash", dimension, "cohortSpec",
            p10, p50, p90, n, "memberRecordIds", "computedAt"
          ) VALUES (
            ${cohort.cohortHash},
            ${cohort.dimension},
            ${JSON.stringify(cohort.cohortSpec)}::jsonb,
            ${cohort.p10}::numeric,
            ${cohort.p50}::numeric,
            ${cohort.p90}::numeric,
            ${cohort.n}::int,
            ${sql.raw(uuidArrayLiteral(cohort.memberRecordIds))},
            now()
          )
          ON CONFLICT ("cohortHash") DO UPDATE SET
            p10 = EXCLUDED.p10,
            p50 = EXCLUDED.p50,
            p90 = EXCLUDED.p90,
            n   = EXCLUDED.n,
            "memberRecordIds" = EXCLUDED."memberRecordIds",
            "computedAt"      = EXCLUDED."computedAt"
        `);
        void cohortHash;
        void specForDimension;
        computed.push({ dimension: dim.name, n: cohort.n });
      }
      return computed;
    });
    } catch (err) {
      await step.run('mark-failed', async () => {
        await failJob({
          investigationId,
          jobKind: 'benchmarks',
          codeOrMessage: 'internal_error',
        });
      });
      throw err;
    }

    await step.run('mark-done', async () => {
      await completeJob({
        investigationId,
        jobKind: 'benchmarks',
        summaryHu: `${result.length} dimenzió kohort frissítve.`,
      });
    });

    await step.sendEvent('emit-computed', {
      name: 'investigation.benchmarks.computed',
      data: {
        investigationId,
        dimensionsComputed: result.map((r) => r.dimension),
        outlierCount: 0,
      },
    });
    // 2026-07-13: dropped the old explicit 'investigation.score.requested'
    // emit here (T081) — investigation-score already listens directly on
    // 'investigation.benchmarks.computed' above, so it was triggering the
    // exact same recompute twice per source. investigation-score now also
    // debounces per investigationId, so this alone isn't the whole fix, but
    // it's pure waste to keep sending a second identical trigger.
    // Addendum 2026-05-19 (T113): notify the damage-recompute pipeline.
    await step.sendEvent('emit-damage', {
      name: 'investigation.benchmark.changed',
      data: { investigationId },
    });

    return { investigationId, computed: result };
  },
);

function uuidArrayLiteral(ids: string[]): string {
  if (ids.length === 0) return `'{}'::uuid[]`;
  const escaped = ids.map((id) => `'${id.replace(/'/g, "''")}'`);
  return `ARRAY[${escaped.join(', ')}]::uuid[]`;
}
