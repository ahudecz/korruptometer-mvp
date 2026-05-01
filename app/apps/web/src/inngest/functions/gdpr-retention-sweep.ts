import 'server-only';
import { and, count, eq, isNotNull, lt, lte, or, sql } from 'drizzle-orm';

import { deleteObject, listOrphans } from '@korr/shared/storage';
import { postSlackDigest } from '@korr/shared/slack';

import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

/**
 * T118-T125 — gdpr.retention-sweep. Daily worker. Four ordered passes:
 *   1. PII purge for approved/rejected/duplicate past purgePiiAt
 *   2. Orphan-storage hard-delete (>7d, no SubmissionAttachment row)
 *   3. Stale-state Slack digest (>14d received, >30d in_review)
 *   4. AuditLog partition retention (NULL actorEditorId for non-pii.read
 *      rows older than 24 months — partition drops happen in T060's
 *      sibling function)
 *
 * pii.read rows are kept the full 24 months even after the underlying
 * Submission is purged (FR-054).
 */
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS ?? 'submissions';

export const gdprRetentionSweep = inngest.createFunction(
  {
    id: 'gdpr-retention-sweep',
    name: 'GDPR retention sweep',
    concurrency: 1,
  },
  [{ cron: '15 3 * * *' }, { event: 'gdpr.retention-sweep' }],
  async ({ step, logger }) => {
    const now = new Date();

    const purged = await step.run('pii-purge', async () => {
      const db = getDb();
      const rows = await db
        .select({
          id: schema.submissions.id,
        })
        .from(schema.submissions)
        .where(
          and(
            or(
              eq(schema.submissions.status, 'approved'),
              eq(schema.submissions.status, 'rejected'),
              eq(schema.submissions.status, 'duplicate'),
            ),
            isNotNull(schema.submissions.purgePiiAt),
            lt(schema.submissions.purgePiiAt, now),
          ),
        );
      let purgedAttachments = 0;
      for (const row of rows) {
        const atts = await db
          .select()
          .from(schema.submissionAttachments)
          .where(eq(schema.submissionAttachments.submissionId, row.id));
        for (const a of atts) {
          await deleteObject({ bucket: BUCKET, key: a.storageKey });
          purgedAttachments += 1;
        }
        await db
          .delete(schema.submissionAttachments)
          .where(eq(schema.submissionAttachments.submissionId, row.id));
        await db
          .update(schema.submissions)
          .set({
            reporterEmailEnc: null,
            reporterNameEnc: null,
            bodyCipher: null,
            reporterEmailCipher: null,
            reporterNameCipher: null,
            purgePiiAt: null,
            updatedAt: now,
          })
          .where(eq(schema.submissions.id, row.id));
      }
      return { purgedRows: rows.length, purgedAttachments };
    });

    const orphans = await step.run('orphan-scan', async () => {
      const db = getDb();
      const objects = await listOrphans({
        bucket: BUCKET,
        prefix: '',
        olderThanDays: 7,
      });
      let deleted = 0;
      for (const obj of objects) {
        const matched = await db.query.submissionAttachments.findFirst({
          where: eq(schema.submissionAttachments.storageKey, obj.key),
        });
        if (matched) continue; // legitimate — never auto-purge.
        await deleteObject({ bucket: BUCKET, key: obj.key });
        deleted += 1;
      }
      return { listed: objects.length, deleted };
    });

    const staleDigest = await step.run('stale-digest', async () => {
      const db = getDb();
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const stale14 = await db
        .select({ value: count() })
        .from(schema.submissions)
        .where(
          and(
            eq(schema.submissions.status, 'received'),
            lte(schema.submissions.createdAt, fourteenDaysAgo),
          ),
        );
      const stale30 = await db
        .select({ value: count() })
        .from(schema.submissions)
        .where(
          and(
            eq(schema.submissions.status, 'in_review'),
            lte(schema.submissions.createdAt, thirtyDaysAgo),
          ),
        );
      const c14 = stale14[0]?.value ?? 0;
      const c30 = stale30[0]?.value ?? 0;
      if (c14 === 0 && c30 === 0) return { posted: false, c14, c30 };
      const message = `:hourglass: Stale submissions — \`received >14d\`: ${c14}, \`in_review >30d\`: ${c30}`;
      const r = await postSlackDigest({ message });
      return { posted: r.posted, c14, c30 };
    });

    const audit = await step.run('partition-retention', async () => {
      const db = getDb();
      const cutoff = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000);
      const r = await db.execute(sql`
        UPDATE "AuditLog"
           SET "actorEditorId" = NULL
         WHERE at < ${cutoff.toISOString()}
           AND action <> 'pii.read'
           AND "actorEditorId" IS NOT NULL
      `);
      // postgres-js exec result includes count for UPDATE.
      const updated = (r as unknown as { count?: number }).count ?? 0;
      return { scrubbed: updated };
    });

    logger?.info?.(
      `gdpr.retention-sweep: purged=${purged.purgedRows} attachments=${purged.purgedAttachments} ` +
        `orphans=${orphans.deleted}/${orphans.listed} stale14=${staleDigest.c14} stale30=${staleDigest.c30} ` +
        `audit=${audit.scrubbed}`,
    );
    return { purged, orphans, staleDigest, audit };
  },
);
