import 'server-only';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { inngest } from '../client';

/**
 * T209 — submissions.rotate-seal. Re-seals every in-flight submission
 * ciphertext to the new editor recipient list. Idempotent and resumable
 * via Inngest step durability.
 *
 * IMPORTANT: this function runs in Phase 4 territory — the server CANNOT
 * unseal plaintext. Re-sealing requires a quorum of editor browsers to
 * collaborate via `/admin/sealed-box/rotate` (T211). What this Inngest
 * function does is enumerate the rows that need re-sealing, group them
 * into batches, and emit `submissions.rotate-seal-batch-ready` events
 * that the rotation UI listens to. Each batch is then re-sealed
 * client-side and POSTed back via the rotate endpoint (T210).
 *
 * Until Phase 4 ships in production this function stays in the registry
 * but its only effect is logging the eligible-row count.
 */
export const sealedBoxRotation = inngest.createFunction(
  {
    id: 'submissions-rotate-seal',
    name: 'Submissions rotate-seal',
    concurrency: 1,
  },
  { event: 'submissions.rotate-seal' },
  async ({ event, step, logger }) => {
    const triggeredBy = event.data?.triggeredBy ?? 'unknown';
    const db = getDb();

    const counts = await step.run('count-eligible', async () => {
      const ctRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.submissions)
        .where(
          and(
            ne(schema.submissions.status, 'rejected'),
            ne(schema.submissions.status, 'duplicate'),
            isNull(schema.submissions.purgePiiAt),
          ),
        );
      const sealedRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.submissions)
        .where(eq(sql`array_length("recipientFingerprints", 1)`, 1));
      return {
        eligible: ctRows[0]?.count ?? 0,
        currentlySealed: sealedRows[0]?.count ?? 0,
      };
    });

    logger?.info?.(
      `submissions.rotate-seal triggeredBy=${triggeredBy} eligible=${counts.eligible} currentlySealed=${counts.currentlySealed}`,
    );

    return { ok: true, triggeredBy, counts };
  },
);
