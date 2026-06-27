import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import type { JobKind, JobState } from '@korr/shared';

import { tError } from './i18n-errors';

/**
 * Helpers that own every transition of `InvestigationJobState`. Inngest
 * functions call these inside `step.run` so retries replay the same
 * transition deterministically (FR-053, FR-054).
 *
 * Contract:
 *   - `startJob` upserts to `running`. Subsequent calls reset
 *     started/finished/error fields so a re-run starts cleanly.
 *   - `completeJob` requires a Hungarian summary; the schema CHECK enforces
 *     this server-side.
 *   - `failJob` always routes `codeOrMessage` through `tError()` so the
 *     stored `errorMessage` is Hungarian (FR-056). The original code is
 *     attached to the Sentry breadcrumb for triage.
 */

type DbHandle = ReturnType<typeof getDb>;

export async function startJob(
  args: {
    investigationId: string;
    jobKind: JobKind;
    inngestRunId?: string | null;
  },
  db: DbHandle = getDb(),
): Promise<void> {
  const { investigationId, jobKind } = args;
  Sentry.addBreadcrumb({
    category: 'investigation.job',
    message: 'start',
    data: { investigationId, jobKind },
  });
  await db.execute(sql`
    INSERT INTO "InvestigationJobState" (
      "investigationId", "jobKind", state, "startedAt", "finishedAt",
      "inngestRunId", summary, "errorMessage", "updatedAt"
    ) VALUES (
      ${investigationId},
      ${jobKind}::job_kind,
      'running'::job_state,
      now(),
      NULL,
      ${args.inngestRunId ?? null},
      NULL,
      NULL,
      now()
    )
    ON CONFLICT ("investigationId", "jobKind") DO UPDATE
      SET state          = 'running'::job_state,
          "startedAt"    = now(),
          "finishedAt"   = NULL,
          "inngestRunId" = EXCLUDED."inngestRunId",
          summary        = NULL,
          "errorMessage" = NULL,
          "updatedAt"    = now()
  `);
}

export async function completeJob(
  args: {
    investigationId: string;
    jobKind: JobKind;
    /** Hungarian one-liner, ≤ ~120 chars recommended. */
    summaryHu: string;
  },
  db: DbHandle = getDb(),
): Promise<void> {
  const { investigationId, jobKind, summaryHu } = args;
  if (!summaryHu || summaryHu.length === 0) {
    throw new Error('completeJob requires a non-empty Hungarian summary');
  }
  Sentry.addBreadcrumb({
    category: 'investigation.job',
    message: 'done',
    data: { investigationId, jobKind, summary: summaryHu },
  });
  await db.execute(sql`
    UPDATE "InvestigationJobState"
       SET state        = 'done'::job_state,
           "finishedAt" = now(),
           summary      = ${summaryHu},
           "errorMessage" = NULL,
           "updatedAt"  = now()
     WHERE "investigationId" = ${investigationId}
       AND "jobKind" = ${jobKind}::job_kind
  `);
}

export async function failJob(
  args: {
    investigationId: string;
    jobKind: JobKind;
    /**
     * An internal error code (preferred — keyed into `i18n-errors.ts`) or
     * a raw English/system message. Either way the stored value is
     * translated through `tError()`; the raw input is attached only to the
     * Sentry breadcrumb.
     */
    codeOrMessage: string;
  },
  db: DbHandle = getDb(),
): Promise<void> {
  const { investigationId, jobKind, codeOrMessage } = args;
  const translated = tError(codeOrMessage);
  Sentry.addBreadcrumb({
    category: 'investigation.job',
    message: 'failed',
    level: 'error',
    data: { investigationId, jobKind, code: codeOrMessage },
  });
  await db.execute(sql`
    UPDATE "InvestigationJobState"
       SET state          = 'failed'::job_state,
           "finishedAt"   = now(),
           summary        = NULL,
           "errorMessage" = ${translated},
           "updatedAt"    = now()
     WHERE "investigationId" = ${investigationId}
       AND "jobKind" = ${jobKind}::job_kind
  `);
}

/** Snapshot read for the polling endpoint / page render. */
export async function readJobStates(
  investigationId: string,
  db: DbHandle = getDb(),
): Promise<
  Array<{
    jobKind: JobKind;
    state: JobState;
    startedAt: string | null;
    finishedAt: string | null;
    inngestRunId: string | null;
    summary: string | null;
    errorMessage: string | null;
    updatedAt: string;
  }>
> {
  const rows = (await db.execute(sql`
    SELECT
      "jobKind"::text       AS "jobKind",
      state::text           AS state,
      "startedAt"           AS "startedAt",
      "finishedAt"          AS "finishedAt",
      "inngestRunId"        AS "inngestRunId",
      summary               AS summary,
      "errorMessage"        AS "errorMessage",
      "updatedAt"           AS "updatedAt"
    FROM "InvestigationJobState"
    WHERE "investigationId" = ${investigationId}
    ORDER BY "jobKind"
  `)) as unknown as Array<{
    jobKind: JobKind;
    state: JobState;
    startedAt: Date | string | null;
    finishedAt: Date | string | null;
    inngestRunId: string | null;
    summary: string | null;
    errorMessage: string | null;
    updatedAt: Date | string;
  }>;
  const toIso = (v: Date | string | null | undefined): string | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') return new Date(v).toISOString();
    return v.toISOString();
  };
  return rows.map((r) => ({
    jobKind: r.jobKind,
    state: r.state,
    startedAt: toIso(r.startedAt),
    finishedAt: toIso(r.finishedAt),
    inngestRunId: r.inngestRunId,
    summary: r.summary,
    errorMessage: r.errorMessage,
    updatedAt: toIso(r.updatedAt)!,
  }));
}
