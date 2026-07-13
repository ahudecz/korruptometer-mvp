import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { eq, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import {
  computeQualityScore,
  computeQuantityScore,
} from '@/lib/investigation/score';
import type {
  EvidenceGrade,
  ExternalRecordDto,
  RedFlagDto,
  Relevance,
} from '@korr/shared';
import { inngest } from '../client';

/**
 * investigation.score (T080, FR-024 / FR-025).
 *
 * Triggered by `investigation.score.requested` and fan-in on
 * `investigation.benchmarks.computed`. Recomputes the two scores and
 * persists them on Investigation along with a bumped updatedAt.
 *
 * Per FR-025 the two scores are NEVER combined into a single opaque
 * number — they are written to their own columns.
 */
export const investigationScore = inngest.createFunction(
  {
    id: 'investigation.score',
    // Xref fans out per external-data source (~13 adapters), each of which
    // can independently trigger a re-score both directly and via its own
    // benchmarks-compute run — same debounce shape (and reasoning) as
    // investigation-damage-recompute.ts. Without this, one xref pass on one
    // investigation was firing investigation.score dozens of times back to
    // back for the exact same data (found 2026-07-13: this + a genuinely
    // duplicate emit in investigation-benchmarks-compute.ts were the primary
    // driver of the Inngest Hobby-plan execution quota being blown through
    // mid-month).
    debounce: { key: 'event.data.investigationId', period: '30s' },
    concurrency: [{ key: 'event.data.investigationId', limit: 1 }],
    retries: 3,
  },
  [
    { event: 'investigation.score.requested' },
    { event: 'investigation.benchmarks.computed' },
  ],
  async ({ event, step }) => {
    const { investigationId } = event.data as { investigationId: string };
    Sentry.addBreadcrumb({
      category: 'investigation.score',
      message: 'start',
      data: { investigationId },
    });

    return step.run('recompute', async () => {
      const db = getDb();
      const recordsRaw = await db
        .select()
        .from(schema.externalRecords)
        .where(eq(schema.externalRecords.investigationId, investigationId));
      const records: ExternalRecordDto[] = recordsRaw.map((r) => ({
        id: r.id,
        sourceSystem: r.sourceSystem as ExternalRecordDto['sourceSystem'],
        externalId: r.externalId,
        canonicalUrl: r.canonicalUrl,
        fetchedAt: r.fetchedAt.toISOString(),
        fetchHash: r.fetchHash,
        recordType: r.recordType,
        relevance: (r.relevance ?? null) as Relevance | null,
        evidenceGrade: (r.evidenceGrade ?? null) as EvidenceGrade | null,
        rawPayload: r.rawPayload,
      }));

      const rfRaw = await db
        .select()
        .from(schema.redFlagChecks)
        .where(eq(schema.redFlagChecks.investigationId, investigationId));
      const redFlags: RedFlagDto[] = rfRaw.map((r) => ({
        ruleId: r.ruleId,
        severity: r.severity as RedFlagDto['severity'],
        verdict: r.verdict as RedFlagDto['verdict'],
        observationHu: r.observationHu,
        supportingRecordIds: r.supportingRecordIds ?? [],
        evaluatedAt: r.evaluatedAt.toISOString(),
      }));

      const quantity = computeQuantityScore(records, redFlags);
      const quality = computeQualityScore(records);

      await db.execute(sql`
        UPDATE "Investigation"
           SET "quantityScore" = ${quantity}::numeric,
               "qualityScore"  = ${quality}::evidence_grade,
               "updatedAt"     = now()
         WHERE id = ${investigationId}
      `);

      return { investigationId, quantityScore: quantity, qualityScore: quality };
    });
  },
);
