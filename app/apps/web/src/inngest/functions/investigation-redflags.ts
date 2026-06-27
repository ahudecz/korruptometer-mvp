import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { eq, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { evaluateAll, type RuleInput } from '@/lib/investigation/redflag-rules';
import { completeJob, failJob, startJob } from '@/lib/investigation/job-state';
import type {
  EvidenceGrade,
  ExternalRecordDto,
  Relevance,
} from '@korr/shared';
import { inngest } from '../client';

/**
 * investigation.redflags (T068, FR-019 / FR-020).
 *
 * Loads the ExternalRecord rows for the investigation, builds a small
 * cluster-facts blob, evaluates the declarative rule registry, upserts
 * RedFlagCheck rows by `(investigationId, ruleId)`, and emits
 * `investigation.score.requested` so the score job re-runs.
 */
export const investigationRedflags = inngest.createFunction(
  {
    id: 'investigation.redflags',
    concurrency: [{ limit: 4 }],
    retries: 3,
  },
  { event: 'investigation.redflags.requested' },
  async ({ event, step }) => {
    const { investigationId } = event.data;
    Sentry.addBreadcrumb({
      category: 'investigation.redflags',
      message: 'start',
      data: { investigationId },
    });

    await step.run('mark-running', async () => {
      await startJob({ investigationId, jobKind: 'redflags' });
    });

    let verdicts: Awaited<ReturnType<typeof evaluateAll>>;
    try {
      verdicts = await step.run('evaluate', async () => {
      const db = getDb();
      const records = await db
        .select()
        .from(schema.externalRecords)
        .where(eq(schema.externalRecords.investigationId, investigationId));
      const dtoRecords: ExternalRecordDto[] = records.map((r) => ({
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
      const input: RuleInput = {
        investigationId,
        records: dtoRecords,
        benchmarkDeviations: [],
        clusterFacts: {
          earliestContractDate: null,
          contractorFoundedAt: null,
          relatedPartyHints: [],
          singleSourceDominanceShare: null,
        },
      };
      const results = evaluateAll(input);

      for (const v of results) {
        await db.execute(sql`
          INSERT INTO "RedFlagCheck" (
            id, "investigationId", "ruleId", severity, verdict,
            "observationHu", "supportingRecordIds", "evaluatedAt"
          ) VALUES (
            gen_random_uuid(),
            ${investigationId},
            ${v.ruleId},
            ${v.severity}::redflag_severity,
            ${v.verdict}::redflag_verdict,
            ${v.observationHu},
            ${sql.raw(uuidArrayLiteral(v.supportingRecordIds))},
            now()
          )
          ON CONFLICT ("investigationId", "ruleId") DO UPDATE
            SET severity              = EXCLUDED.severity,
                verdict               = EXCLUDED.verdict,
                "observationHu"       = EXCLUDED."observationHu",
                "supportingRecordIds" = EXCLUDED."supportingRecordIds",
                "evaluatedAt"         = EXCLUDED."evaluatedAt"
        `);
      }
      return results;
    });
    } catch (err) {
      await step.run('mark-failed', async () => {
        await failJob({
          investigationId,
          jobKind: 'redflags',
          codeOrMessage: 'internal_error',
        });
      });
      throw err;
    }

    await step.run('mark-done', async () => {
      const failed = verdicts.filter((v) => v.verdict === 'fail').length;
      await completeJob({
        investigationId,
        jobKind: 'redflags',
        summaryHu: `${verdicts.length} szabály kiértékelve, ${failed} gyanús.`,
      });
    });

    await step.sendEvent('emit-score', {
      name: 'investigation.score.requested',
      data: { investigationId, reason: 'redflags.completed' },
    });
    // Addendum 2026-05-19 (T113): notify the damage-recompute pipeline.
    await step.sendEvent('emit-damage', {
      name: 'investigation.redflag.changed',
      data: { investigationId },
    });

    return { investigationId, ruleCount: verdicts.length };
  },
);

function uuidArrayLiteral(ids: string[]): string {
  if (!ids || ids.length === 0) return `'{}'::uuid[]`;
  const escaped = ids.map((id) => `'${id.replace(/'/g, "''")}'`);
  return `ARRAY[${escaped.join(', ')}]::uuid[]`;
}
