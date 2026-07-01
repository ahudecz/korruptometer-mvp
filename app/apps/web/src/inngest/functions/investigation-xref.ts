import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { withSourceSystemLock } from '@/lib/investigation/source-lock';
import { completeJob, failJob, startJob } from '@/lib/investigation/job-state';
import {
  type Adapter,
  type AdapterQuery,
  type RawExternalRecord,
  tedAdapter,
  ekrAdapter,
  keAdapter,
  palyazatAdapter,
  ecegjegyzekAdapter,
  opencorporatesAdapter,
  integritasAdapter,
  olafAdapter,
  kshAdapter,
  eurostatAdapter,
  kmonitorAdapter,
  atlatszoAdapter,
  webarchiveAdapter,
} from '@korr/scrapers';

import { inngest } from '../client';

const ADAPTERS: Adapter[] = [
  tedAdapter,
  ekrAdapter,
  keAdapter,
  palyazatAdapter,
  ecegjegyzekAdapter,
  opencorporatesAdapter,
  integritasAdapter,
  olafAdapter,
  kshAdapter,
  eurostatAdapter,
  kmonitorAdapter,
  atlatszoAdapter,
  webarchiveAdapter,
];

function canonicalisePayload(payload: unknown): string {
  // Stable stringify: keys sorted at every level so the same logical
  // payload always produces the same hash regardless of key order.
  const sort = (v: unknown): unknown => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const keys = Object.keys(v as Record<string, unknown>).sort();
      const out: Record<string, unknown> = {};
      for (const k of keys) out[k] = sort((v as Record<string, unknown>)[k]);
      return out;
    }
    if (Array.isArray(v)) return v.map(sort);
    return v;
  };
  return JSON.stringify(sort(payload));
}

export function fetchHashOf(payload: unknown): string {
  return createHash('sha256').update(canonicalisePayload(payload)).digest('hex');
}

/**
 * investigation.xref (T054, FR-013, FR-015, FR-016).
 *
 * Triggered by `investigation.xref.requested`. For each adapter, runs
 * the fetch under a per-source-system advisory lock, upserts each
 * record into ExternalRecord keyed on
 * `(investigationId, sourceSystem, externalId)`, refreshes
 * `Investigation.oldestExternalRecordFetchedAt`, and emits
 * `investigation.xref.source.completed` per source so the benchmark
 * compute fans in.
 */
export const investigationXref = inngest.createFunction(
  {
    id: 'investigation.xref',
    concurrency: [{ limit: 4 }],
    retries: 3,
  },
  { event: 'investigation.xref.requested' },
  async ({ event, step }) => {
    const { investigationId } = event.data;
    Sentry.addBreadcrumb({
      category: 'investigation.xref',
      message: 'start',
      data: { investigationId },
    });

    await step.run('mark-running', async () => {
      await startJob({ investigationId, jobKind: 'xref' });
    });

    const query = await step.run('build-query', async () => buildQueryFor(investigationId));
    if (!query) {
      await step.run('mark-skipped', async () => {
        await failJob({
          investigationId,
          jobKind: 'xref',
          codeOrMessage: 'internal_error',
        });
      });
      return { skipped: 'investigation_missing' };
    }

    const perSource: Array<{ sourceSystem: string; recordsWritten: number }> = [];
    try {
    for (const adapter of ADAPTERS) {
      const source = adapter.sourceSystem;
      const written = await step.run(`adapter-${source}`, async () => {
        try {
          const records = await withSourceSystemLock(
            source,
            adapter.perHostGateMs,
            () => adapter.fetch(query),
          );
          if (records.length === 0) return 0;
          return upsertRecords(investigationId, records);
        } catch (err) {
          Sentry.captureException(err, {
            tags: {
              fn: 'investigation.xref',
              sourceSystem: source,
              investigationId,
            },
          });
          return 0;
        }
      });
      perSource.push({ sourceSystem: source, recordsWritten: written });

      await step.sendEvent(`emit-${source}-completed`, {
        name: 'investigation.xref.source.completed',
        data: {
          investigationId,
          sourceSystem: source,
          recordsWritten: written,
        },
      });
      // T081 — score job re-runs after every per-source completion so
      // the case page always reflects the latest signals.
      await step.sendEvent(`emit-${source}-score`, {
        name: 'investigation.score.requested',
        data: { investigationId, reason: `xref.source.completed.${source}` },
      });
      // Addendum 2026-05-19 (T113): notify the damage-recompute pipeline.
      // Debounced upstream so per-source events collapse into one recompute.
      if (written > 0) {
        await step.sendEvent(`emit-${source}-damage`, {
          name: 'investigation.external-record.changed',
          data: { investigationId },
        });
      }
    }

    await step.run('refresh-oldest', async () => {
      const db = getDb();
      await db.execute(sql`
        UPDATE "Investigation"
           SET "oldestExternalRecordFetchedAt" = (
                 SELECT MIN("fetchedAt") FROM "ExternalRecord"
                  WHERE "investigationId" = ${investigationId}
               ),
               "updatedAt" = now()
         WHERE id = ${investigationId}
      `);
    });
    } catch (err) {
      await step.run('mark-failed', async () => {
        await failJob({
          investigationId,
          jobKind: 'xref',
          codeOrMessage: 'internal_error',
        });
      });
      throw err;
    }

    await step.run('mark-done', async () => {
      const writtenTotal = perSource.reduce(
        (acc, p) => acc + p.recordsWritten,
        0,
      );
      await completeJob({
        investigationId,
        jobKind: 'xref',
        summaryHu: `${writtenTotal} rekord ${perSource.length} forrásból.`,
      });
    });

    return { investigationId, perSource };
  },
);

async function buildQueryFor(
  investigationId: string,
): Promise<AdapterQuery | null> {
  const db = getDb();
  const rows = await db
    .select({
      primaryPersonName: schema.investigations.primaryPersonName,
      primaryPersonNormalized: schema.investigations.primaryPersonNormalized,
      primaryEntityName: schema.investigations.primaryEntityName,
    })
    .from(schema.investigations)
    .where(eq(schema.investigations.id, investigationId))
    .limit(1);
  if (!rows[0]) return null;
  return {
    primaryPersonName: rows[0].primaryPersonNormalized
      ?? rows[0].primaryPersonName
      ?? undefined,
    primaryEntityName: rows[0].primaryEntityName ?? undefined,
  };
}

async function upsertRecords(
  investigationId: string,
  records: RawExternalRecord[],
): Promise<number> {
  const db = getDb();
  let written = 0;
  for (const r of records) {
    if (!r.externalId || !r.canonicalUrl) continue;
    const hash = fetchHashOf(r.rawPayload);
    await db.execute(sql`
      INSERT INTO "ExternalRecord" (
        id, "investigationId", "sourceSystem", "externalId",
        "canonicalUrl", "fetchedAt", "fetchHash", "recordType",
        "rawPayload", relevance, "evidenceGrade", "createdAt"
      ) VALUES (
        gen_random_uuid(),
        ${investigationId},
        ${r.sourceSystem}::external_source_system,
        ${r.externalId},
        ${r.canonicalUrl},
        now(),
        ${hash},
        ${r.recordType},
        ${JSON.stringify(r.rawPayload)}::jsonb,
        ${r.relevance ?? null}::relevance,
        ${r.evidenceGrade ?? null}::evidence_grade,
        now()
      )
      ON CONFLICT ("investigationId", "sourceSystem", "externalId") DO UPDATE
        SET "fetchedAt"     = EXCLUDED."fetchedAt",
            "fetchHash"     = EXCLUDED."fetchHash",
            "rawPayload"    = EXCLUDED."rawPayload",
            "relevance"     = COALESCE("ExternalRecord"."relevance", EXCLUDED."relevance"),
            "evidenceGrade" = COALESCE("ExternalRecord"."evidenceGrade", EXCLUDED."evidenceGrade")
    `);
    written += 1;
  }
  return written;
}
