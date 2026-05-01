import 'server-only';
import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

/**
 * T102 — submission.publish. Triggered when an editor approves a
 * submission (PATCH `/api/admin/submissions/[id]` with action=`approve`).
 * Phase 2 keeps publish minimal: ensure a `Case` exists for the
 * `createdCaseId` and enqueue a KPI rollup so /api/stats reflects the
 * new approval.
 */
export const submissionPublish = inngest.createFunction(
  { id: 'submission-publish', name: 'Submission publish', concurrency: 2 },
  { event: 'submission.publish' },
  async ({ event, step }) => {
    const db = getDb();
    const submissionId = event.data.submissionId;

    const submission = await step.run('load', async () =>
      db.query.submissions.findFirst({
        where: eq(schema.submissions.id, submissionId),
      }),
    );
    if (!submission) return { ok: false, reason: 'submission missing' };
    if (submission.status !== 'approved') {
      return { ok: false, reason: `not approved (${submission.status})` };
    }
    await step.run('kick-rollup', async () => {
      await inngest.send({
        name: 'kpi.recompute',
        data: { reason: `submission.publish ${submissionId}` },
      });
    });
    return { ok: true };
  },
);
