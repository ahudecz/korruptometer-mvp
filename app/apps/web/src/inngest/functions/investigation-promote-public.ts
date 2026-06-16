import 'server-only';
import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { revalidateTag } from 'next/cache';
import { eq, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { EVIDENCE_GRADE_ORDER } from '@korr/shared';
import type { EvidenceGrade } from '@korr/shared';
import { inngest } from '../client';

/**
 * investigation.promote-public (T087, FR-028, FR-030).
 *
 * Five-write atomic transaction (re-evaluates the FR-026 predicate at
 * commit time). The function never leaves a half-written case.
 *
 * Writes:
 *   1. INSERT Case (the wanted-poster public row)
 *   2. (no Case_* dependents in current schema — see plan re-eval table)
 *   3. UPDATE Investigation { publicCaseId, disclosureTier='public', updatedAt }
 *   4. INSERT InvestigationPublicCaseLink (history)
 *   5. AuditLog
 *
 * The kpi-rollup is event-driven; we emit `kpi.recompute` after commit so
 * the public stats reflect the new case. `revalidateTag('stats')` also
 * runs post-commit (Principle V).
 */
export const investigationPromotePublic = inngest.createFunction(
  {
    id: 'investigation.promote-public',
    concurrency: [{ key: 'event.data.investigationId', limit: 1 }],
    retries: 3,
  },
  { event: 'investigation.promote.public.requested' },
  async ({ event, step }) => {
    const { investigationId, requestedByEditorId, expectedUpdatedAt } = event.data;
    Sentry.addBreadcrumb({
      category: 'investigation.promote-public',
      message: 'start',
      data: { investigationId },
    });
    const result = await step.run('atomic-promote', async () => {
      const db = getDb();
      return db.transaction(async (tx) => {
        const inv = await tx
          .select()
          .from(schema.investigations)
          .where(eq(schema.investigations.id, investigationId))
          .limit(1);
        if (!inv[0]) {
          return { ok: false as const, error: 'not_found' };
        }
        // Optimistic-concurrency re-check at commit time.
        if (inv[0].updatedAt.toISOString() !== expectedUpdatedAt) {
          return { ok: false as const, error: 'stale' };
        }
        if (inv[0].disclosureTier === 'public' && inv[0].publicCaseId) {
          return {
            ok: false as const,
            error: 'already_promoted',
            publicCaseId: inv[0].publicCaseId,
          };
        }
        // FR-026 predicate re-check.
        const qty = Number(inv[0].quantityScore);
        const qual = inv[0].qualityScore as EvidenceGrade | null;
        const passesGate =
          qty >= 2
          && qual !== null
          && EVIDENCE_GRADE_ORDER.indexOf(qual)
            >= EVIDENCE_GRADE_ORDER.indexOf('investigative_journalism');
        if (!passesGate) {
          return {
            ok: false as const,
            error: 'predicate_failed',
            detail: {
              quantityScore: inv[0].quantityScore,
              qualityScore: qual,
            },
          };
        }
        // Mint a fresh Case id. Format mirrors the existing convention
        // (text primary key, kebab-case derived).
        const caseId = `inv-${investigationId.slice(0, 8)}-${randomUUID().slice(0, 4)}`;
        const name = inv[0].primaryPersonName ?? '(ismeretlen alany)';
        await tx.execute(sql`
          INSERT INTO "Case" (
            id, name, position, amount, "sentenceYears", "caseYear",
            status, region, sector, summary, "createdAt", "updatedAt"
          ) VALUES (
            ${caseId}, ${name}, ${'gyanúsított'}, 0::bigint, 0,
            ${new Date().getUTCFullYear()},
            'Folyamatban'::case_status, 'Magyarország', 'Egyéb'::sector,
            ${inv[0].summary ?? null},
            now(), now()
          )
        `);
        await tx
          .update(schema.investigations)
          .set({
            publicCaseId: caseId,
            disclosureTier: 'public',
            updatedAt: sql`now()` as unknown as Date,
          })
          .where(eq(schema.investigations.id, investigationId));
        await tx.insert(schema.investigationPublicCaseLinks).values({
          investigationId,
          publicCaseId: caseId,
          promotedByEditorId: requestedByEditorId || null,
        });
        await tx.insert(schema.auditLogs).values({
          actorEditorId: requestedByEditorId || null,
          action: 'investigation.tier.promoted.public',
          entityType: 'Investigation',
          entityId: investigationId,
          detail: { publicCaseId: caseId },
        });
        return { ok: true as const, publicCaseId: caseId };
      });
    });

    if (result.ok) {
      await step.sendEvent('emit-kpi-recompute', {
        name: 'kpi.recompute',
        data: { reason: `investigation.promoted.public:${result.publicCaseId}` },
      });
      try {
        revalidateTag('stats');
      } catch {
        /* revalidateTag is unavailable outside the Next.js runtime in some Inngest cron contexts */
      }
    }
    return result;
  },
);
