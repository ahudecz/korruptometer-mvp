import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

/**
 * investigation.anonymize-dsr (T088, FR-034 / FR-035).
 *
 * Triggered by `investigation.dsr.deletion.upheld`. For every
 * Investigation whose primaryPersonNormalized matches the subject,
 * anonymize the row (keep the audit refs resolvable); hard-delete every
 * ArticleClaim whose `parties` JSON names the subject.
 */
export const investigationAnonymizeDsr = inngest.createFunction(
  {
    id: 'investigation.anonymize-dsr',
    concurrency: [{ limit: 1 }],
    retries: 3,
  },
  { event: 'investigation.dsr.deletion.upheld' },
  async ({ event, step }) => {
    const { subjectNormalizedName, dsrRequestId } = event.data;
    Sentry.addBreadcrumb({
      category: 'investigation.anonymize-dsr',
      message: 'start',
      data: { subjectNormalizedName, dsrRequestId },
    });

    const summary = await step.run('anonymize', async () => {
      const db = getDb();
      return db.transaction(async (tx) => {
        // 1) Anonymize matching Investigation rows.
        const updatedRows = (await tx.execute(sql`
          UPDATE "Investigation"
             SET "primaryPersonName"       = '[redacted]',
                 "primaryPersonNormalized" = NULL,
                 summary                   = CASE
                                                WHEN summary IS NULL THEN NULL
                                                ELSE regexp_replace(
                                                       summary,
                                                       ${subjectNormalizedName},
                                                       '[redacted]',
                                                       'gi')
                                              END,
                 "updatedAt"               = now()
           WHERE "primaryPersonNormalized" = ${subjectNormalizedName}
           RETURNING id
        `)) as Array<{ id: string }>;

        // 2) Hard-delete ArticleClaim rows whose parties JSON names the
        //    subject (FR-035). We test the lowercased normalizedName
        //    field on each party entry.
        const deletedClaims = (await tx.execute(sql`
          DELETE FROM "ArticleClaim"
           WHERE EXISTS (
                   SELECT 1
                     FROM jsonb_array_elements(parties) AS p
                    WHERE LOWER(p->>'normalizedName') = ${subjectNormalizedName}
                 )
           RETURNING id
        `)) as Array<{ id: string }>;

        // 3) Audit row(s).
        for (const r of updatedRows) {
          await tx.insert(schema.auditLogs).values({
            actorEditorId: null,
            action: 'investigation.anonymized',
            entityType: 'Investigation',
            entityId: r.id,
            detail: { dsrRequestId, subjectNormalizedName },
          });
        }
        return {
          investigationsAnonymized: updatedRows.length,
          claimsDeleted: deletedClaims.length,
        };
      });
    });

    return { dsrRequestId, ...summary };
  },
);
