import 'server-only';

import { createHash } from 'node:crypto';

import type {
  CorruptionMechanism,
  DamageComponentDto,
  DamageConfidence,
  DamageEstimateDto,
  EvidenceGrade,
} from '@korr/shared';

import { CITATIONS, citationDto } from './damage-citations';

/**
 * Pure helpers that turn investigation inputs into a `DamageEstimateDto`.
 * No DB access; the Inngest function (`investigation.damage-recompute`,
 * T111) is responsible for assembling `DamageInputs` from DB rows and
 * persisting the assembled estimate.
 *
 * Coverage:
 *   FR-041  benchmark-deviation overpricing
 *   FR-042  amendment-delta inflation
 *   FR-043  single-bidder / no-bid industry estimate
 *   FR-044  related-party industry estimate
 *   FR-045  phantom-service claim consolidation
 *   FR-046  claim deduplication (claim-group consolidation)
 *   FR-047  cross-component cap by contract value (priority: overpricing >
 *           amendment_inflation > kickback > no_bid > phantom_service)
 *   FR-048  inputsHash for the debounce short-circuit
 */

// ────────────────────────────────────────────────────────────────────────────
// Input shape
// ────────────────────────────────────────────────────────────────────────────

export type AmendmentFact = {
  /** ISO date string. Informational only — not used in math. */
  effectiveAt?: string;
  /** Positive value-delta in HUF; non-positive entries are ignored. */
  increaseHuf: bigint;
};

export type ContractFact = {
  externalRecordId: string;
  /** Source system, e.g. `'TED'`. Used for ordering in audit messages. */
  sourceSystem: string;
  /** Contract value in HUF. May be null when the source carries no value. */
  valueHuf: bigint | null;
  /** Optional contract-dimension quantity (e.g. m²). */
  quantity?: number | null;
  /** Optional benchmark dimension this contract participates in. */
  dimension?: string | null;
  /** Optional list of value-increasing amendments. */
  amendments?: AmendmentFact[];
  /** Evidence grade carried by the record; null when source-implicit. */
  evidenceGrade?: EvidenceGrade | null;
};

export type CohortFact = {
  cohortHash: string;
  dimension: string;
  /** Numeric percentile values (HUF per unit-quantity). */
  p10: number;
  p50: number;
  p90: number;
  n: number;
};

export type RedFlagFact = {
  id: string;
  ruleId:
    | 'single_bidder'
    | 'no_bid'
    | 'related_party'
    | 'amendment_inflation'
    | string;
  verdict: 'pass' | 'fail' | 'not_applicable';
  /** External record(s) this verdict cites; used to anchor a damage component. */
  supportingRecordIds: string[];
};

export type ClaimFact = {
  id: string;
  mechanism: CorruptionMechanism;
  allegedAmountHuf: bigint | null;
  /** 0–100. Higher wins the dedup group's amount. */
  confidence: number;
  /** Year the claim references; used by dedup grouping. */
  referenceYear?: number | null;
  /** Normalized vendor name; used by dedup grouping. */
  vendorNormalized?: string | null;
};

export type DamageInputs = {
  investigationId: string;
  contracts: ContractFact[];
  cohorts: CohortFact[];
  redFlags: RedFlagFact[];
  claims: ClaimFact[];
  /** Minimum cohort size for benchmark_deviation. */
  cohortMinN?: number;
  /** Stable timestamp for deterministic hashing in tests. */
  nowIso?: string;
};

export const DEFAULT_COHORT_MIN_N = 10;

// ────────────────────────────────────────────────────────────────────────────
// Per-mechanism formulas
// ────────────────────────────────────────────────────────────────────────────

function clampNonNegative(n: bigint): bigint {
  return n < 0n ? 0n : n;
}

function bigintFromNumber(n: number): bigint {
  if (!Number.isFinite(n)) return 0n;
  // Truncate toward zero; we're computing HUF estimates, sub-forint
  // precision is meaningless.
  return BigInt(Math.trunc(n));
}

function fmtHufHU(value: bigint): string {
  return new Intl.NumberFormat('hu-HU').format(value);
}

/** FR-041 — overpricing benchmark deviation. */
export function computeOverpricing(
  contract: ContractFact,
  cohort: CohortFact,
  cohortMinN: number = DEFAULT_COHORT_MIN_N,
): DamageComponentDto | null {
  if (cohort.n < cohortMinN) return null;
  if (contract.valueHuf == null || !contract.quantity || !contract.dimension)
    return null;
  if (cohort.dimension !== contract.dimension) return null;

  const p10Total = bigintFromNumber(cohort.p10 * contract.quantity);
  const p90Total = bigintFromNumber(cohort.p90 * contract.quantity);
  const low = clampNonNegative(contract.valueHuf - p90Total);
  const high = clampNonNegative(contract.valueHuf - p10Total);
  if (low === 0n && high === 0n) return null;

  return {
    mechanism: 'overpricing',
    lowHuf: low.toString(),
    highHuf: high.toString(),
    method: 'benchmark_deviation',
    inputs: {
      externalRecordIds: [contract.externalRecordId],
      benchmarkCohortHash: cohort.cohortHash,
      formula:
        `${fmtHufHU(contract.valueHuf)} Ft − cohort_p10/p90 ` +
        `(${cohort.dimension}, n=${cohort.n}) × ${contract.quantity}`,
    },
    notes: '',
  };
}

/** FR-042 — amendment-delta inflation. */
export function computeAmendmentDelta(
  contract: ContractFact,
): DamageComponentDto | null {
  const amendments = contract.amendments ?? [];
  const increases = amendments
    .map((a) => a.increaseHuf)
    .filter((v): v is bigint => typeof v === 'bigint' && v > 0n);
  if (increases.length === 0) return null;
  const mid = increases.reduce((acc, v) => acc + v, 0n);
  const low = (mid * 80n) / 100n;
  const high = (mid * 120n) / 100n;
  return {
    mechanism: 'amendment_inflation',
    lowHuf: low.toString(),
    highHuf: high.toString(),
    method: 'amendment_delta',
    inputs: {
      externalRecordIds: [contract.externalRecordId],
      formula: `SUM(${increases.length} módosítás) × [0.80, 1.20]`,
    },
    notes: '',
  };
}

/** FR-043 — single-bidder / no-bid premium. */
export function computeSingleBidderPremium(
  contract: ContractFact,
  flag: RedFlagFact,
): DamageComponentDto | null {
  if (flag.verdict !== 'fail') return null;
  if (contract.valueHuf == null) return null;
  const cite = CITATIONS.single_bidder;
  const low = bigintFromNumber(Number(contract.valueHuf) * cite.lowFrac);
  const high = bigintFromNumber(Number(contract.valueHuf) * cite.highFrac);
  if (low === 0n && high === 0n) return null;
  const mechanism: CorruptionMechanism =
    flag.ruleId === 'no_bid' ? 'no_bid' : 'no_bid';
  return {
    mechanism,
    lowHuf: low.toString(),
    highHuf: high.toString(),
    method: 'industry_estimate',
    inputs: {
      externalRecordIds: [contract.externalRecordId],
      formula:
        `${fmtHufHU(contract.valueHuf)} Ft × ` +
        `[${(cite.lowFrac * 100).toFixed(0)}%, ${(cite.highFrac * 100).toFixed(0)}%]`,
      citation: citationDto(cite),
    },
    notes: 'Egyetlen ajánlattevő — OECD iparági becslés alapján.',
  };
}

/** FR-044 — related-party / kickback estimate. */
export function computeRelatedPartyEstimate(
  contract: ContractFact,
  flag: RedFlagFact,
): DamageComponentDto | null {
  if (flag.verdict !== 'fail') return null;
  if (contract.valueHuf == null) return null;
  const cite = CITATIONS.related_party;
  const low = bigintFromNumber(Number(contract.valueHuf) * cite.lowFrac);
  const high = bigintFromNumber(Number(contract.valueHuf) * cite.highFrac);
  if (low === 0n && high === 0n) return null;
  return {
    mechanism: 'kickback',
    lowHuf: low.toString(),
    highHuf: high.toString(),
    method: 'industry_estimate',
    inputs: {
      externalRecordIds: [contract.externalRecordId],
      formula:
        `${fmtHufHU(contract.valueHuf)} Ft × ` +
        `[${(cite.lowFrac * 100).toFixed(0)}%, ${(cite.highFrac * 100).toFixed(0)}%]`,
      citation: citationDto(cite),
    },
    notes:
      'Közeli érdekeltség — Világbank kormányzati-korrupció becslés alapján.',
  };
}

/** FR-045 — phantom-service claim consolidation. */
export function computePhantomService(
  claims: ClaimFact[],
  contract: ContractFact | null,
): DamageComponentDto | null {
  const phantoms = claims.filter(
    (c) => c.mechanism === 'phantom_service' && c.allegedAmountHuf != null,
  );
  if (phantoms.length === 0) return null;
  const amounts = phantoms.map((c) => c.allegedAmountHuf!) as bigint[];
  let low = amounts.reduce((acc, v) => (v < acc ? v : acc), amounts[0]!);
  let high = amounts.reduce((acc, v) => (v > acc ? v : acc), amounts[0]!);

  const contractCap = contract?.valueHuf ?? null;
  if (contractCap != null) {
    if (low > contractCap) low = contractCap;
    if (high > contractCap) high = contractCap;
  } else {
    low = (low * 70n) / 100n;
    high = (high * 130n) / 100n;
  }

  return {
    mechanism: 'phantom_service',
    lowHuf: low.toString(),
    highHuf: high.toString(),
    method: 'claim_consolidation',
    inputs: {
      claimIds: phantoms.map((c) => c.id),
      ...(contract ? { externalRecordIds: [contract.externalRecordId] } : {}),
      formula:
        contractCap != null
          ? `min(claim, szerződés=${fmtHufHU(contractCap)} Ft) … max(claim)`
          : `min(claim) × 0.70 … max(claim) × 1.30 (nincs szerződés-horgony)`,
    },
    notes: '',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// FR-046 — claim deduplication
// ────────────────────────────────────────────────────────────────────────────

/**
 * Claim-groups are formed by (vendor_normalized, year, amount within ±20%).
 * The group's amount is taken from the highest-confidence claim. Returns
 * one representative claim per group; raw claims without a vendor or year
 * pass through unchanged (cannot be confidently grouped).
 */
export function dedupClaims(claims: ClaimFact[]): ClaimFact[] {
  const grouped: ClaimFact[][] = [];
  for (const claim of claims) {
    if (
      claim.allegedAmountHuf == null ||
      !claim.vendorNormalized ||
      claim.referenceYear == null
    ) {
      grouped.push([claim]);
      continue;
    }
    const placed = grouped.find((group) => {
      const head = group[0]!;
      if (head.vendorNormalized !== claim.vendorNormalized) return false;
      if (head.referenceYear !== claim.referenceYear) return false;
      if (head.allegedAmountHuf == null) return false;
      const a = Number(head.allegedAmountHuf);
      const b = Number(claim.allegedAmountHuf);
      if (a === 0) return b === 0;
      return Math.abs(b - a) / a <= 0.2;
    });
    if (placed) placed.push(claim);
    else grouped.push([claim]);
  }
  return grouped.map((group) =>
    group.reduce((best, cur) => (cur.confidence > best.confidence ? cur : best)),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FR-047 — cross-component cap
// ────────────────────────────────────────────────────────────────────────────

const CAP_PRIORITY: CorruptionMechanism[] = [
  'overpricing',
  'amendment_inflation',
  'kickback',
  'no_bid',
  'phantom_service',
  'related_party',
  'other',
];

function priorityRank(m: CorruptionMechanism): number {
  const i = CAP_PRIORITY.indexOf(m);
  return i === -1 ? CAP_PRIORITY.length : i;
}

/**
 * For each `ExternalRecord` referenced by ≥ 1 component, cap the components
 * so their total `highHuf` does not exceed `contract.valueHuf`. Lower-
 * priority components are capped first.
 */
export function capComponentsByContract(
  components: DamageComponentDto[],
  contracts: ContractFact[],
): DamageComponentDto[] {
  const result = components.map((c) => ({ ...c }));
  for (const contract of contracts) {
    if (contract.valueHuf == null) continue;
    const indices = result
      .map((c, i) => ({ c, i }))
      .filter(({ c }) =>
        c.inputs.externalRecordIds?.includes(contract.externalRecordId),
      )
      .sort((a, b) => priorityRank(a.c.mechanism) - priorityRank(b.c.mechanism));
    let remaining = contract.valueHuf;
    for (const { c, i } of indices) {
      const high = BigInt(c.highHuf);
      const low = BigInt(c.lowHuf);
      if (high <= remaining) {
        remaining -= high;
        continue;
      }
      const cappedHigh = remaining < 0n ? 0n : remaining;
      const cappedLow = low > cappedHigh ? cappedHigh : low;
      result[i] = {
        ...c,
        lowHuf: cappedLow.toString(),
        highHuf: cappedHigh.toString(),
        notes:
          c.notes && c.notes.length > 0
            ? `${c.notes} (sapka: szerződés-érték)`
            : 'Felső érték a szerződés-értékre sapkázva.',
      };
      remaining = 0n;
    }
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Confidence derivation
// ────────────────────────────────────────────────────────────────────────────

const HIGH_GRADE: EvidenceGrade[] = ['audit_report', 'court_document'];
const MEDIUM_GRADE: EvidenceGrade[] = [
  'investigative_journalism',
  'prosecutor_statement',
];

function deriveConfidence(
  contracts: ContractFact[],
  cohorts: CohortFact[],
): DamageConfidence {
  const grades = contracts
    .map((c) => c.evidenceGrade ?? null)
    .filter((g): g is EvidenceGrade => g != null);
  const hasHigh = grades.some((g) => HIGH_GRADE.includes(g));
  const hasMedium = grades.some((g) => MEDIUM_GRADE.includes(g));
  const everyCohortBig = cohorts.length > 0 && cohorts.every((c) => c.n >= 30);
  const someCohortOk = cohorts.some((c) => c.n >= DEFAULT_COHORT_MIN_N);
  if (hasHigh && (cohorts.length === 0 || everyCohortBig)) return 'high';
  if (hasMedium || someCohortOk) return 'medium';
  return 'low';
}

// ────────────────────────────────────────────────────────────────────────────
// inputsHash (FR-048 debounce short-circuit)
// ────────────────────────────────────────────────────────────────────────────

export function computeInputsHash(inputs: DamageInputs): string {
  const canonical = JSON.stringify({
    claimIds: inputs.claims.map((c) => c.id).sort(),
    externalRecordIds: inputs.contracts
      .map((c) => c.externalRecordId)
      .sort(),
    redFlagIds: inputs.redFlags.map((f) => f.id).sort(),
    benchmarkCohortHashes: inputs.cohorts.map((c) => c.cohortHash).sort(),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

// ────────────────────────────────────────────────────────────────────────────
// assembleEstimate
// ────────────────────────────────────────────────────────────────────────────

export function assembleEstimate(
  inputs: DamageInputs,
): Omit<DamageEstimateDto, 'computedAt'> {
  const minN = inputs.cohortMinN ?? DEFAULT_COHORT_MIN_N;
  const dedupedClaims = dedupClaims(inputs.claims);
  const raw: DamageComponentDto[] = [];

  // Per-contract components: overpricing, amendment_delta, phantom_service.
  for (const contract of inputs.contracts) {
    if (contract.dimension) {
      const cohort = inputs.cohorts.find(
        (c) => c.dimension === contract.dimension,
      );
      if (cohort) {
        const overpricing = computeOverpricing(contract, cohort, minN);
        if (overpricing) raw.push(overpricing);
      }
    }
    const amendment = computeAmendmentDelta(contract);
    if (amendment) raw.push(amendment);
  }

  // Industry estimates triggered by failing red flags. We pair the flag with
  // the first matching contract in its supportingRecordIds; absent that, the
  // first contract on the investigation. Components without an anchor are
  // suppressed (no valueHuf, no math).
  const pickContract = (flag: RedFlagFact): ContractFact | null => {
    if (flag.supportingRecordIds.length > 0) {
      const match = inputs.contracts.find((c) =>
        flag.supportingRecordIds.includes(c.externalRecordId),
      );
      if (match) return match;
    }
    return inputs.contracts[0] ?? null;
  };

  for (const flag of inputs.redFlags) {
    if (flag.verdict !== 'fail') continue;
    const contract = pickContract(flag);
    if (!contract) continue;
    if (flag.ruleId === 'single_bidder' || flag.ruleId === 'no_bid') {
      const comp = computeSingleBidderPremium(contract, flag);
      if (comp) raw.push(comp);
    }
    if (flag.ruleId === 'related_party') {
      const comp = computeRelatedPartyEstimate(contract, flag);
      if (comp) raw.push(comp);
    }
  }

  // Phantom service is consolidated across all matching claims at once; we
  // anchor on the first contract that has a value (if any) for the cap.
  const phantomAnchor =
    inputs.contracts.find((c) => c.valueHuf != null) ?? null;
  const phantom = computePhantomService(dedupedClaims, phantomAnchor);
  if (phantom) raw.push(phantom);

  // Apply FR-047 cap.
  const capped = capComponentsByContract(raw, inputs.contracts);

  // Totals.
  let totalLow = 0n;
  let totalHigh = 0n;
  for (const c of capped) {
    totalLow += BigInt(c.lowHuf);
    totalHigh += BigInt(c.highHuf);
  }
  // Final guard.
  if (totalHigh < totalLow) totalHigh = totalLow;

  return {
    investigationId: inputs.investigationId,
    totalLowHuf: totalLow.toString(),
    totalHighHuf: totalHigh.toString(),
    confidence: deriveConfidence(inputs.contracts, inputs.cohorts),
    components: capped,
    inputsHash: computeInputsHash(inputs),
  };
}
