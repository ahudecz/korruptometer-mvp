import 'server-only';
import { eq } from 'drizzle-orm';

import { scanObject } from '@korr/shared/virus-scan';
import { headObject, deleteObject, MAX_BYTES } from '@korr/shared/storage';
import { postSlackDigest } from '@korr/shared/slack';

import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

/**
 * T091 / T092 — submission.intake.
 *
 * Per attachment:
 *   1. Re-read Content-Length from Storage (defense-in-depth — a forged
 *      browser-side range can lie). Delete + reject anything > MAX_BYTES.
 *   2. Run scanObject (Cloudmersive). On `infected`, quarantine + reject
 *      the submission + Slack alert. On `clean`, persist the result. On
 *      `pending` / `error`, leave the row pending and surface a banner
 *      via DB-flag.
 *
 * `submission.publish` (T102) is enqueued separately by the editor's
 * approve action — it doesn't fire here.
 */
export const submissionIntake = inngest.createFunction(
  { id: 'submission-intake', name: 'Submission intake', concurrency: 4 },
  { event: 'submission.intake' },
  async ({ event, step, logger }) => {
    const db = getDb();
    const submissionId = event.data.submissionId;
    const attachments = await step.run('list-attachments', async () =>
      db
        .select()
        .from(schema.submissionAttachments)
        .where(eq(schema.submissionAttachments.submissionId, submissionId)),
    );

    let infected = false;
    let pendingVendor = false;

    for (const att of attachments) {
      const result = await step.run(`scan-${att.id}`, async () => {
        // Defense-in-depth oversize check.
        const head = await headObject({
          bucket: process.env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS ?? 'submissions',
          key: att.storageKey,
        });
        if (head && head.sizeBytes > MAX_BYTES) {
          await deleteObject({
            bucket: process.env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS ?? 'submissions',
            key: att.storageKey,
          });
          await db
            .update(schema.submissionAttachments)
            .set({ virusScanStatus: 'error', virusScanDetail: 'oversize' })
            .where(eq(schema.submissionAttachments.id, att.id));
          return { status: 'error', detail: 'oversize' } as const;
        }

        const scan = await scanObject({
          bucket: process.env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS ?? 'submissions',
          key: att.storageKey,
        });
        await db
          .update(schema.submissionAttachments)
          .set({ virusScanStatus: scan.status, virusScanDetail: scan.detail ?? null })
          .where(eq(schema.submissionAttachments.id, att.id));
        return scan;
      });

      if (result.status === 'infected') {
        infected = true;
        await step.run(`quarantine-${att.id}`, async () => {
          await deleteObject({
            bucket: process.env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS ?? 'submissions',
            key: att.storageKey,
          });
        });
      }
      if (result.status === 'pending' || result.status === 'error') {
        pendingVendor = true;
      }
    }

    if (infected) {
      await step.run('mark-rejected', async () => {
        await db
          .update(schema.submissions)
          .set({
            status: 'rejected',
            purgePiiAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
          })
          .where(eq(schema.submissions.id, submissionId));
      });
      await step.run('slack-alert', async () => {
        await postSlackDigest({
          message: `:warning: Vírus észlelve a ${submissionId} bejelentésen — csatolmány karanténba.`,
        });
      });
      return { ok: true, infected: true };
    }

    if (pendingVendor) {
      logger?.info?.(`submission.intake: vendor outage, leaving ${submissionId} pending`);
      return { ok: true, pendingVendor: true };
    }

    await step.run('emit-publish', async () => {
      await inngest.send({ name: 'submission.publish', data: { submissionId } });
    });
    return { ok: true, clean: true };
  },
);
