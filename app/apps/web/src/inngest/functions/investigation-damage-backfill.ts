import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';

import { inngest } from '../client';

/**
 * investigation.damage-backfill (T114, addendum 2026-05-19).
 *
 * One-shot helper that walks every existing `Investigation` row and emits
 * one `investigation.external-record.changed` event per row. The recompute
 * function (`investigation.damage-recompute`) is debounced on
 * `event.data.investigationId`, so successive emits collapse into one
 * recompute per case.
 *
 * Operational notes:
 *   - Triggered manually (event `investigation.damage-backfill`).
 *   - Rate-limited to ~50 events/sec by batching with a 1 s pause between
 *     batches of 50.
 *   - Runs once on staging, once on production behind the existing
 *     operator approval flow. After production has drained, the function
 *     and its event type can be removed in a follow-up PR.
 */
const BATCH_SIZE = 50;
const BATCH_PAUSE_MS = 1000;

export const investigationDamageBackfill = inngest.createFunction(
  {
    id: 'investigation.damage-backfill',
    concurrency: 1,
    retries: 0,
  },
  { event: 'investigation.damage-backfill' as const },
  async ({ step, logger }) => {
    Sentry.addBreadcrumb({
      category: 'investigation.damage-backfill',
      message: 'start',
    });

    const ids = await step.run('list-investigations', async () => {
      const db = getDb();
      const rows = (await db.execute(
        sql`SELECT id FROM "Investigation" ORDER BY "createdAt" ASC`,
      )) as unknown as Array<{ id: string }>;
      return rows.map((r) => r.id);
    });

    let emitted = 0;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      await step.run(`emit-batch-${i}`, async () => {
        await Promise.all(
          batch.map((investigationId) =>
            inngest.send({
              name: 'investigation.external-record.changed',
              data: { investigationId },
            }),
          ),
        );
      });
      emitted += batch.length;
      logger?.info?.(
        { batch: i / BATCH_SIZE, emitted, total: ids.length },
        'damage-backfill batch emitted',
      );
      if (i + BATCH_SIZE < ids.length) {
        await step.sleep(`pause-after-${i}`, `${BATCH_PAUSE_MS}ms`);
      }
    }

    return { emitted, total: ids.length };
  },
);
