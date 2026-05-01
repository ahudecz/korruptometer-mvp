import 'server-only';
import { sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

import { inngest } from '../client';

/**
 * worker.heartbeat (T171) — every 5 min execute SELECT 1 and upsert the
 * singleton WorkerHeartbeat row. /healthz consults the freshness of this
 * row to decide liveness independent from real job cadence (FR-074).
 */
export const workerHeartbeat = inngest.createFunction(
  { id: 'worker-heartbeat', name: 'Worker heartbeat' },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    await step.run('beat', async () => {
      const db = getDb();
      await db.execute(sql`SELECT 1`);
      await db
        .insert(schema.workerHeartbeats)
        .values({ id: 'singleton', at: new Date() })
        .onConflictDoUpdate({
          target: schema.workerHeartbeats.id,
          set: { at: new Date() },
        });
    });
    return { ok: true };
  },
);
