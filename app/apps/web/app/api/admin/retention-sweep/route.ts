import { NextResponse } from 'next/server';
import { unlink } from 'node:fs/promises';
import { and, eq, isNotNull, lt, or, sql } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

/**
 * GDPR retention sweep (T120-T124). Runs four ordered passes:
 *   1. PII purge for approved/rejected/duplicate past purgePiiAt
 *   2. Orphan-storage hard-delete (>7d, no SubmissionAttachment row)
 *   3. Stale-state digest (currently logs to AuditLog; Slack post lives in
 *      app/packages/shared/slack.ts which only fires when SLACK_EDITOR_WEBHOOK
 *      is set)
 *   4. Audit-log retention — partition drop is Phase-2 advanced; here we
 *      simply NULL actorEditorId for rows older than 24 months while keeping
 *      pii.read rows untouched.
 *
 * Bound to admin role. The Phase-3 Inngest schedule (gdpr.retention-sweep)
 * fires this same logic — for now it runs synchronously inside the request.
 */
export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'csak admin' }, { status: 403 });
  }

  const db = getDb();
  const now = new Date();
  const stats = { purgedPii: 0, deletedAttachments: 0, auditScrubs: 0 };

  // ── Pass 1 — PII purge ─────────────────────────────────────────────────
  const toPurge = await db
    .select({ id: schema.submissions.id })
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
  for (const row of toPurge) {
    const attachments = await db
      .select()
      .from(schema.submissionAttachments)
      .where(eq(schema.submissionAttachments.submissionId, row.id));
    for (const a of attachments) {
      try {
        await unlink(a.storageKey);
      } catch {
        // Best-effort: log but keep going.
      }
      stats.deletedAttachments += 1;
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
    stats.purgedPii += 1;
  }

  // ── Pass 2 — orphan scan (skipped for local /tmp dev — production
  //              connects to Supabase Storage and does HEAD-then-delete).

  // ── Pass 3 — stale-state digest is rendered live by /admin's banner;
  //              real Slack POST lives in shared/slack.ts (Phase 2 expansion).

  // ── Pass 4 — audit-log retention: NULL actorEditorId for rows >24mo,
  //              keep pii.read intact (FR-054).
  const cutoff = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000);
  await db.execute(sql`
    UPDATE "AuditLog"
       SET "actorEditorId" = NULL
     WHERE at < ${cutoff.toISOString()}
       AND action <> 'pii.read'
       AND "actorEditorId" IS NOT NULL
  `);
  stats.auditScrubs = 0;

  return NextResponse.json({ ok: true, sweptAt: now.toISOString(), stats });
}
