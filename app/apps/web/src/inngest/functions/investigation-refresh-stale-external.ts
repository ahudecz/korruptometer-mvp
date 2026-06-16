import 'server-only';
import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { asc, desc, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

/**
 * investigation.refresh-stale-external (T056, FR-015).
 *
 * Nightly job at 03:00 Europe/Budapest. Picks the top
 * `REFRESH_STALE_TOP_N` investigations ordered by
 * (articleCount DESC, oldestExternalRecordFetchedAt ASC) and emits
 * `investigation.xref.requested` per row so the standard fan-out path
 * runs against them — no new code path needed.
 */
export const investigationRefreshStaleExternal = inngest.createFunction(
  {
    id: 'investigation.refresh-stale-external',
    concurrency: [{ limit: 1 }],
    retries: 3,
  },
  { cron: 'TZ=Europe/Budapest 0 3 * * *' },
  async ({ step }) => {
    const limit = Math.max(
      1,
      Math.min(
        1000,
        Number.parseInt(process.env.REFRESH_STALE_TOP_N ?? '100', 10) || 100,
      ),
    );
    const rows = await step.run('pick-candidates', async () => {
      const db = getDb();
      return db
        .select({ id: schema.investigations.id })
        .from(schema.investigations)
        .orderBy(
          desc(schema.investigations.articleCount),
          asc(schema.investigations.oldestExternalRecordFetchedAt),
        )
        .limit(limit);
    });

    if (rows.length === 0) {
      return { dispatched: 0 };
    }

    const events = rows.map((r) => ({
      name: 'investigation.xref.requested' as const,
      data: {
        investigationId: r.id,
        requestedByEditorId: '',
        runId: randomUUID(),
      },
    }));
    await step.sendEvent('emit-xref-batch', events);
    Sentry.addBreadcrumb({
      category: 'investigation.refresh-stale-external',
      message: 'dispatched',
      data: { count: events.length },
    });
    void sql;
    return { dispatched: events.length };
  },
);
