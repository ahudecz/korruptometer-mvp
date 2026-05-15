import 'server-only';
import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';

import { inngest } from '../client';

/**
 * kmonitor.traverse-approved-tags — daily cron. Reads every approved
 * KMonitorTagCandidate row and emits one kmonitor.traverse-tag event per
 * candidate so per-tag traversals fan out across Inngest workers.
 */
export const kmonitorTraverseApprovedTags = inngest.createFunction(
  {
    id: 'kmonitor-traverse-approved-tags',
    name: 'K-Monitor: traverse approved tags',
    concurrency: 1,
  },
  { cron: '0 3 * * *' },
  async ({ step }) => {
    const approved = await step.run('list-approved', async () => {
      const db = getDb();
      return db
        .select({
          id: schema.kMonitorTagCandidates.id,
          slug: schema.kMonitorTagCandidates.slug,
        })
        .from(schema.kMonitorTagCandidates)
        .where(eq(schema.kMonitorTagCandidates.approvalState, 'approved'));
    });

    if (approved.length === 0) return { emitted: 0 };

    await step.sendEvent(
      'emit-traversals',
      approved.map((c) => ({
        name: 'kmonitor.traverse-tag' as const,
        data: { candidateId: c.id, slug: c.slug },
      })),
    );

    return { emitted: approved.length };
  },
);
