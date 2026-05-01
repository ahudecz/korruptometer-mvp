import 'server-only';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { inngest } from '../client';

/**
 * T060 — auditlog.partition-maintenance. Runs on the 25th of each month
 * (cron `0 6 25 * *`) to create next month's `AuditLog_*` partition. The
 * 0003 migration creates the parent + first 12 monthly partitions; this
 * function keeps the rolling window full.
 */
export const auditlogPartitionMaintenance = inngest.createFunction(
  {
    id: 'auditlog-partition-maintenance',
    name: 'AuditLog partition maintenance',
    concurrency: 1,
  },
  { cron: '0 6 25 * *' },
  async ({ step, logger }) => {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const after = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1));
    const yyyy = next.getUTCFullYear();
    const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
    const partitionName = `AuditLog_${yyyy}_${mm}`;

    await step.run('ensure-partition', async () => {
      const db = getDb();
      const startIso = next.toISOString().slice(0, 10);
      const endIso = after.toISOString().slice(0, 10);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ${sql.identifier(partitionName)}
        PARTITION OF "AuditLog"
        FOR VALUES FROM (${startIso}) TO (${endIso})
      `);
      logger?.info?.(`ensured partition ${partitionName} (${startIso}..${endIso})`);
    });

    return { ok: true, partition: partitionName };
  },
);
