import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { eq, inArray, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import {
  assembleEstimate,
  computeInputsHash,
  DEFAULT_COHORT_MIN_N,
  type AmendmentFact,
  type CohortFact,
  type ClaimFact,
  type ContractFact,
  type DamageInputs,
  type RedFlagFact,
} from '@/lib/investigation/damage';
import { completeJob, failJob, startJob } from '@/lib/investigation/job-state';
import type { DamageEstimateDto } from '@korr/shared';

import { inngest } from '../client';

/**
 * investigation.damage-recompute (T111, FR-048).
 *
 * Triggered by any of the four input-changed events emitted at the end of
 * the upstream investigation functions. Debounced by `investigationId` so
 * concurrent input changes collapse into a single recompute. Short-circuits
 * when `inputsHash` matches the stored value.
 *
 * Writes `DamageEstimate` and an `InvestigationJobState{ jobKind:
 * 'damage_recompute' }` row reflecting the latest run.
 */
export const investigationDamageRecompute = inngest.createFunction(
  {
    id: 'investigation.damage-recompute',
    debounce: {
      key: 'event.data.investigationId',
      period: '30s',
    },
    concurrency: [{ key: 'event.data.investigationId', limit: 1 }],
    retries: 3,
  },
  [
    { event: 'investigation.claim.changed' },
    { event: 'investigation.external-record.changed' },
    { event: 'investigation.redflag.changed' },
    { event: 'investigation.benchmark.changed' },
  ],
  async ({ event, step }) => {
    const { investigationId } = event.data as { investigationId: string };
    Sentry.addBreadcrumb({
      category: 'investigation.damage-recompute',
      message: 'start',
      data: { investigationId },
    });

    await step.run('mark-running', async () => {
      await startJob({
        investigationId,
        jobKind: 'damage_recompute',
        inngestRunId: null,
      });
    });

    try {
      const result = await step.run('recompute', async () => {
        const inputs = await loadInputs(investigationId);
        const hash = computeInputsHash(inputs);
        const db = getDb();

        const existing = (await db.execute(sql`
          SELECT "inputsHash" AS "inputsHash"
          FROM "DamageEstimate"
          WHERE "investigationId" = ${investigationId}
          LIMIT 1
        `)) as unknown as Array<{ inputsHash: string }>;
        if (existing[0]?.inputsHash === hash) {
          return { investigationId, shortCircuited: true } as const;
        }

        const dto = assembleEstimate(inputs);
        const componentsJson = JSON.stringify(dto.components);
        await db.execute(sql`
          INSERT INTO "DamageEstimate" (
            "investigationId", "totalLowHuf", "totalHighHuf",
            confidence, components, "inputsHash", "computedAt"
          ) VALUES (
            ${investigationId},
            ${dto.totalLowHuf}::bigint,
            ${dto.totalHighHuf}::bigint,
            ${dto.confidence}::damage_confidence,
            ${componentsJson}::jsonb,
            ${dto.inputsHash},
            now()
          )
          ON CONFLICT ("investigationId") DO UPDATE
            SET "totalLowHuf"  = EXCLUDED."totalLowHuf",
                "totalHighHuf" = EXCLUDED."totalHighHuf",
                confidence     = EXCLUDED.confidence,
                components     = EXCLUDED.components,
                "inputsHash"   = EXCLUDED."inputsHash",
                "computedAt"   = now()
        `);

        return {
          investigationId,
          shortCircuited: false,
          components: dto.components.length,
          totalLowHuf: dto.totalLowHuf,
          totalHighHuf: dto.totalHighHuf,
        } as const;
      });

      await step.run('mark-done', async () => {
        const summary = result.shortCircuited
          ? 'Nincs változás (inputsHash egyezik).'
          : `${result.components} komponens, ${result.totalLowHuf}..${result.totalHighHuf} Ft.`;
        await completeJob({
          investigationId,
          jobKind: 'damage_recompute',
          summaryHu: summary,
        });
      });

      return result;
    } catch (err) {
      await step.run('mark-failed', async () => {
        await failJob({
          investigationId,
          jobKind: 'damage_recompute',
          codeOrMessage: 'internal_error',
        });
      });
      throw err;
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// Input loaders
// ────────────────────────────────────────────────────────────────────────────

async function loadInputs(investigationId: string): Promise<DamageInputs> {
  const db = getDb();

  const externalRecords = await db
    .select()
    .from(schema.externalRecords)
    .where(eq(schema.externalRecords.investigationId, investigationId));
  const contracts: ContractFact[] = externalRecords.map((r) =>
    contractFromRecord(r),
  );

  const redFlagRows = await db
    .select()
    .from(schema.redFlagChecks)
    .where(eq(schema.redFlagChecks.investigationId, investigationId));
  const redFlags: RedFlagFact[] = redFlagRows.map((r) => ({
    id: r.id,
    ruleId: r.ruleId,
    verdict: r.verdict as 'pass' | 'fail' | 'not_applicable',
    supportingRecordIds: r.supportingRecordIds ?? [],
  }));

  const links = await db
    .select()
    .from(schema.investigationArticleLinks)
    .where(
      eq(schema.investigationArticleLinks.investigationId, investigationId),
    );
  const claims: ClaimFact[] =
    links.length === 0
      ? []
      : await loadClaimsForArticles(links).then((rows) =>
          rows.map((r) => ({
            id: r.id,
            mechanism: r.mechanism as ClaimFact['mechanism'],
            allegedAmountHuf:
              r.allegedAmountHuf == null ? null : (r.allegedAmountHuf as bigint),
            confidence: r.confidence,
            // Reference year and vendor name are not first-class on the
            // claim row; dedup falls back to the pass-through path until
            // the extractor surfaces these fields explicitly.
            referenceYear: null,
            vendorNormalized: null,
          })),
        );

  const dimensions = contracts
    .map((c) => c.dimension)
    .filter((d): d is string => typeof d === 'string' && d.length > 0);
  const cohorts: CohortFact[] =
    dimensions.length === 0
      ? []
      : await loadCohortsForDimensions(Array.from(new Set(dimensions)));

  const minN = Number(process.env.DAMAGE_COHORT_MIN_N ?? DEFAULT_COHORT_MIN_N);
  return {
    investigationId,
    contracts,
    cohorts,
    redFlags,
    claims,
    cohortMinN: Number.isFinite(minN) && minN > 0 ? minN : DEFAULT_COHORT_MIN_N,
  };
}

type ExternalRecordRow = typeof schema.externalRecords.$inferSelect;

function contractFromRecord(r: ExternalRecordRow): ContractFact {
  const payload =
    r.rawPayload && typeof r.rawPayload === 'object'
      ? (r.rawPayload as Record<string, unknown>)
      : {};
  return {
    externalRecordId: r.id,
    sourceSystem: r.sourceSystem,
    valueHuf: readBigint(payload['valueHuf']),
    quantity: readNumber(payload['quantity']),
    dimension: readString(payload['dimension']),
    amendments: readAmendments(payload['amendments']),
    evidenceGrade: r.evidenceGrade ?? null,
  };
}

function readBigint(v: unknown): bigint | null {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isFinite(v))
    return BigInt(Math.trunc(v));
  if (typeof v === 'string' && /^-?\d+$/.test(v)) return BigInt(v);
  return null;
}

function readNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readAmendments(v: unknown): AmendmentFact[] {
  if (!Array.isArray(v)) return [];
  const out: AmendmentFact[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const increase = readBigint((item as Record<string, unknown>)['increaseHuf']);
    if (!increase || increase <= 0n) continue;
    out.push({
      increaseHuf: increase,
      effectiveAt: readString(
        (item as Record<string, unknown>)['effectiveAt'],
      ) ?? undefined,
    });
  }
  return out;
}

async function loadClaimsForArticles(
  links: Array<{ articleSource: string; articleId: string }>,
): Promise<Array<typeof schema.articleClaims.$inferSelect>> {
  if (links.length === 0) return [];
  const db = getDb();
  // articleClaims uses (articleSource, articleId) — assemble an OR list.
  const pairs = links.map(
    (l) => sql`("articleSource" = ${l.articleSource}::article_source AND "articleId" = ${l.articleId})`,
  );
  const orExpr = sql.join(pairs, sql.raw(' OR '));
  const rows = (await db.execute(sql`
    SELECT * FROM "ArticleClaim" WHERE ${orExpr}
  `)) as unknown as Array<typeof schema.articleClaims.$inferSelect>;
  return rows;
}

async function loadCohortsForDimensions(
  dimensions: string[],
): Promise<CohortFact[]> {
  if (dimensions.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.benchmarks)
    .where(inArray(schema.benchmarks.dimension, dimensions));
  return rows.map((b) => ({
    cohortHash: b.cohortHash,
    dimension: b.dimension,
    p10: Number(b.p10),
    p50: Number(b.p50),
    p90: Number(b.p90),
    n: b.n,
  }));
}

/**
 * Re-export the assembled DTO shape for tests that build expectations
 * against the function's external contract without importing the helpers.
 */
export type DamageRecomputeResult = DamageEstimateDto;
