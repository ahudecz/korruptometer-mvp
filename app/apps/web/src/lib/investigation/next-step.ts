import 'server-only';

import type {
  AvailableAction,
  InvestigationJobStateDto,
  JobKind,
  NextStepBannerDto,
  NextStepBannerKind,
} from '@korr/shared';

/**
 * FR-055 priority selector. Pure and deterministic so tests can lock the
 * priority order across the fixture set (SC-019, T126).
 *
 * Priority (top wins; at most one banner is ever returned):
 *   1. failed   — any job is in `failed` state
 *   2. stale    — an external record's `fetchedAt` is > 365 days old
 *   3. missing_xref     — no ExternalRecord rows yet
 *   4. missing_redflags — no RedFlagCheck rows yet
 *   5. predicate_newly_passes — promotion predicate now passes for a tier
 *      the investigation is not yet on
 *   6. (no banner)
 */

export type NextStepState = {
  /** Per-job-kind state map; absent kinds default to `idle`. */
  jobStates: InvestigationJobStateDto[];
  /** ISO timestamp of the most recent external record `fetchedAt`. */
  newestExternalRecordFetchedAt: string | null;
  /** True when the investigation has at least one `ExternalRecord` row. */
  hasExternalRecords: boolean;
  /** True when the investigation has at least one `RedFlagCheck` row. */
  hasRedFlags: boolean;
  /** Predicate evaluation result for each tier promotion. */
  availableActions: AvailableAction[];
  /** Stable timestamp for deterministic testing. */
  nowMs?: number;
};

const STALE_DAYS = 365;
const MS_PER_DAY = 86_400_000;

export const NEXT_STEP_PRIORITY: NextStepBannerKind[] = [
  'job_failed',
  'stale_external_record',
  'missing_xref',
  'missing_redflags',
  'predicate_newly_passes',
];

export function pickNextStep(state: NextStepState): NextStepBannerDto | null {
  const now = state.nowMs ?? Date.now();

  // 1. job_failed — surface the first failed job in jobKind order.
  const failed = state.jobStates
    .filter((j) => j.state === 'failed')
    .sort((a, b) => a.jobKind.localeCompare(b.jobKind))[0];
  if (failed) {
    return {
      kind: 'job_failed',
      messageHu: `Hiba a(z) ${jobKindHu(failed.jobKind)} futása közben: ${failed.errorMessage ?? '—'} Próbáld újra.`,
      actionHref: actionForJobKind(failed.jobKind),
      actionLabelHu: 'Újrapróbálás',
    };
  }

  // 2. stale_external_record — newest record older than STALE_DAYS.
  if (state.newestExternalRecordFetchedAt) {
    const ageDays =
      (now - Date.parse(state.newestExternalRecordFetchedAt)) / MS_PER_DAY;
    if (Number.isFinite(ageDays) && ageDays > STALE_DAYS) {
      return {
        kind: 'stale_external_record',
        messageHu: `A legfrissebb külső rekord ${Math.floor(ageDays)} napos. Frissítsd a cross-reference-t.`,
        actionHref: '#run-xref',
        actionLabelHu: 'Cross-reference futtatása',
      };
    }
  }

  // 3. missing_xref — no ExternalRecord yet.
  if (!state.hasExternalRecords) {
    return {
      kind: 'missing_xref',
      messageHu:
        'Még nincs cross-reference. Futtasd, hogy TED/EKR rekordokat húzhassunk a nyomozáshoz.',
      actionHref: '#run-xref',
      actionLabelHu: 'Cross-reference futtatása',
    };
  }

  // 4. missing_redflags — has external records, no red flags yet.
  if (!state.hasRedFlags) {
    return {
      kind: 'missing_redflags',
      messageHu:
        'A vörös zászlók még nem futottak le ezen a nyomozáson.',
      actionHref: '#run-redflags',
      actionLabelHu: 'Vörös zászlók ellenőrzése',
    };
  }

  // 5. predicate_newly_passes — promote-to-* action is available but tier
  // hasn't moved yet. We can't know "newly" without an observer of past
  // state; we approximate by surfacing the highest-tier available promotion.
  const promote = pickPromotion(state.availableActions);
  if (promote) {
    return {
      kind: 'predicate_newly_passes',
      messageHu: `Készen áll a(z) ${tierHu(promote)} promotálásra — az előfeltételek teljesülnek.`,
      actionHref: `#${promote}`,
      actionLabelHu: tierActionLabel(promote),
    };
  }

  return null;
}

function jobKindHu(k: JobKind): string {
  switch (k) {
    case 'xref':
      return 'cross-reference';
    case 'redflags':
      return 'vörös zászlók';
    case 'hypothesis_loop':
      return 'hipotézis-hurok';
    case 'benchmarks':
      return 'benchmark';
    case 'damage_recompute':
      return 'kárbecslés';
  }
}

function actionForJobKind(k: JobKind): string {
  switch (k) {
    case 'xref':
      return '#run-xref';
    case 'redflags':
      return '#run-redflags';
    case 'hypothesis_loop':
      return '#run-hypothesis-loop';
    case 'benchmarks':
      return '#run-benchmarks';
    case 'damage_recompute':
      return '#recompute-damage';
  }
}

function pickPromotion(
  actions: AvailableAction[],
): 'promote_journalist' | 'promote_prosecutor' | 'promote_public' | null {
  if (actions.includes('promote_public')) return 'promote_public';
  if (actions.includes('promote_prosecutor')) return 'promote_prosecutor';
  if (actions.includes('promote_journalist')) return 'promote_journalist';
  return null;
}

function tierHu(
  a: 'promote_journalist' | 'promote_prosecutor' | 'promote_public',
): string {
  switch (a) {
    case 'promote_journalist':
      return 'újságírói';
    case 'promote_prosecutor':
      return 'ügyészi';
    case 'promote_public':
      return 'publikus';
  }
}

function tierActionLabel(
  a: 'promote_journalist' | 'promote_prosecutor' | 'promote_public',
): string {
  switch (a) {
    case 'promote_journalist':
      return 'Újságírói szintre';
    case 'promote_prosecutor':
      return 'Ügyészi szintre';
    case 'promote_public':
      return 'Publikálás';
  }
}
