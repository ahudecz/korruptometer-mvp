import 'server-only';

import type {
  ArticleClaimDto,
  ExternalRecordDto,
  RedFlagDto,
  SignalContributionDto,
  SignalSourceKind,
} from '@korr/shared';

import { stalenessDecay } from './score';

/**
 * Derive `SignalContribution` rows from the raw inputs that feed
 * `Investigation.quantityScore` (FR-050). The summation rule matches
 * `score.ts` exactly so the FR-051 invariant
 * `quantityScore = Σ effectiveWeight ± 0.01` holds by construction.
 *
 * This module is pure: no DB access. The Inngest function that owns the
 * write path (`investigation.score`, extended for the addendum) is
 * responsible for fetching the inputs and persisting the rows.
 */

type BenchmarkInput = {
  cohortHash: string;
  n: number;
  computedAt: string | Date;
  /**
   * `true` when this benchmark fired as an outlier for the investigation
   * — caller-computed (the outlier check lives in `benchmarks.ts`).
   */
  isOutlier: boolean;
};

export type DerivedSignal = Omit<SignalContributionDto, 'id'>;

const RED_FLAG_BASE_WEIGHT: Record<'medium' | 'high' | 'critical', number> = {
  medium: 0.5,
  high: 0.8,
  critical: 1.0,
};

function multiplierFor(iso: string, nowMs: number): number {
  // Reuse the existing helper so the bands stay single-sourced.
  return stalenessDecay(iso, nowMs);
}

function fmt(n: number): string {
  return n.toFixed(2);
}

/**
 * Derives one `SignalContribution` per contributing signal.
 *
 * `external_record` — one row per distinct `sourceSystem` with
 *   `relevance='corroborates'`; multiple records from the same system count
 *   once (the row carries the *freshest* sourceId so the multiplier reflects
 *   the best-available evidence).
 *
 * `red_flag` — one row per failing red flag with severity ≥ medium.
 *
 * `claim_corroboration` — one row per distinct `articleSource:articleId`
 *   that contributed to consolidation (≥ 2 articles naming the same primary
 *   party + mechanism).
 *
 * `benchmark_deviation` — one row per outlier benchmark with `n ≥ 10`.
 */
export function deriveSignals(args: {
  records: ExternalRecordDto[];
  redFlags: RedFlagDto[];
  claims: ArticleClaimDto[];
  benchmarks: BenchmarkInput[];
  nowMs?: number;
}): DerivedSignal[] {
  const nowMs = args.nowMs ?? Date.now();
  const out: DerivedSignal[] = [];

  // --- external_record ----------------------------------------------------
  const bestPerSource = new Map<
    string,
    { record: ExternalRecordDto; multiplier: number }
  >();
  for (const record of args.records) {
    if (record.relevance !== 'corroborates') continue;
    const mult = multiplierFor(record.fetchedAt, nowMs);
    const prev = bestPerSource.get(record.sourceSystem);
    if (!prev || mult > prev.multiplier) {
      bestPerSource.set(record.sourceSystem, { record, multiplier: mult });
    }
  }
  for (const { record, multiplier } of bestPerSource.values()) {
    out.push(
      contribution('external_record', record.id, 1.0, multiplier, record.fetchedAt),
    );
  }

  // --- red_flag -----------------------------------------------------------
  for (const flag of args.redFlags) {
    if (flag.verdict !== 'fail') continue;
    if (
      flag.severity !== 'medium' &&
      flag.severity !== 'high' &&
      flag.severity !== 'critical'
    )
      continue;
    const base = RED_FLAG_BASE_WEIGHT[flag.severity];
    const multiplier = multiplierFor(flag.evaluatedAt, nowMs);
    out.push(
      contribution('red_flag', flag.ruleId, base, multiplier, flag.evaluatedAt),
    );
  }

  // --- claim_corroboration -----------------------------------------------
  // Group claims by (primary party normalized name + mechanism). When two or
  // more distinct articles agree, each contributing article earns one row.
  const groups = new Map<string, ArticleClaimDto[]>();
  for (const c of args.claims) {
    const primary = (c.parties[0]?.normalizedName ?? '').trim();
    if (!primary) continue;
    const key = `${primary}|${c.mechanism}`;
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }
  for (const arr of groups.values()) {
    const distinctArticles = new Set(
      arr.map((c) => `${c.articleSource}:${c.articleId}`),
    );
    if (distinctArticles.size < 2) continue;
    // Emit one row per distinct article, keyed on the article id so re-runs
    // upsert deterministically.
    for (const articleKey of distinctArticles) {
      const sample = arr.find(
        (c) => `${c.articleSource}:${c.articleId}` === articleKey,
      )!;
      const multiplier = multiplierFor(sample.createdAt, nowMs);
      out.push(
        contribution(
          'claim_corroboration',
          articleKey,
          0.5,
          multiplier,
          sample.createdAt,
        ),
      );
    }
  }

  // --- benchmark_deviation -----------------------------------------------
  for (const b of args.benchmarks) {
    if (!b.isOutlier) continue;
    if (b.n < 10) continue;
    const iso =
      b.computedAt instanceof Date
        ? b.computedAt.toISOString()
        : (b.computedAt as unknown as string);
    const multiplier = multiplierFor(iso, nowMs);
    out.push(contribution('benchmark_deviation', b.cohortHash, 0.5, multiplier, iso));
  }

  return out;
}

function contribution(
  sourceKind: SignalSourceKind,
  sourceId: string,
  base: number,
  multiplier: number,
  addedAtIso: string,
): DerivedSignal {
  return {
    sourceKind,
    sourceId,
    baseWeight: fmt(base),
    stalenessMultiplier: fmt(multiplier),
    effectiveWeight: fmt(base * multiplier),
    addedAt: addedAtIso,
  };
}

/** Σ effectiveWeight rounded to two decimals (matches `score.ts` rounding). */
export function sumSignals(rows: Array<Pick<SignalContributionDto, 'effectiveWeight'>>): number {
  const total = rows.reduce((acc, r) => acc + Number(r.effectiveWeight), 0);
  return Number(total.toFixed(2));
}
