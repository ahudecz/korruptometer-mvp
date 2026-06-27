import 'server-only';

import type {
  EvidenceGrade,
  ExternalRecordDto,
  RedFlagDto,
} from '@korr/shared';
import { EVIDENCE_GRADE_ORDER } from '@korr/shared';

const STALENESS_THRESHOLD_DAYS = 540;
const RED_FLAG_WEIGHT = 1;
const CORROBORATING_RELEVANCE = 'corroborates';
const MEDIUM_OR_HIGHER: Array<'medium' | 'high' | 'critical'> = [
  'medium',
  'high',
  'critical',
];

export function stalenessDecay(fetchedAtIso: string, nowMs = Date.now()): number {
  const t = Date.parse(fetchedAtIso);
  if (Number.isNaN(t)) return 1;
  const ageDays = (nowMs - t) / (1000 * 60 * 60 * 24);
  return ageDays <= STALENESS_THRESHOLD_DAYS ? 1 : 0.5;
}

/**
 * quantityScore (FR-024).
 *
 * Σ over distinct sourceSystem (relevance='corroborates') of
 *   1.0 × stalenessDecay(record.fetchedAt)
 * + Σ over RedFlagCheck rows with verdict='fail' AND severity in
 *   ('medium', 'high', 'critical') of 1.0.
 */
export function computeQuantityScore(
  records: ExternalRecordDto[],
  redFlags: RedFlagDto[],
  nowMs = Date.now(),
): number {
  let total = 0;
  const seenSources = new Map<string, number>();
  for (const r of records) {
    if (r.relevance !== CORROBORATING_RELEVANCE) continue;
    const decay = stalenessDecay(r.fetchedAt, nowMs);
    const prev = seenSources.get(r.sourceSystem) ?? 0;
    // Take the *best* (highest) contribution per distinct source system
    // — a fresh record outranks an older one, so the source contributes
    // 1.0 if any non-stale record is present, else 0.5.
    if (decay > prev) seenSources.set(r.sourceSystem, decay);
  }
  for (const v of seenSources.values()) total += v;
  for (const rf of redFlags) {
    if (rf.verdict !== 'fail') continue;
    if (!MEDIUM_OR_HIGHER.includes(rf.severity as 'medium' | 'high' | 'critical')) continue;
    total += RED_FLAG_WEIGHT;
  }
  return Number(total.toFixed(2));
}

/**
 * qualityScore (FR-024).
 *
 * `qualityScore = max ordinal of ExternalRecord.evidenceGrade`. Returns
 * `null` when no record carries an evidenceGrade.
 */
export function computeQualityScore(
  records: ExternalRecordDto[],
): EvidenceGrade | null {
  let bestIdx = -1;
  for (const r of records) {
    if (!r.evidenceGrade) continue;
    const idx = EVIDENCE_GRADE_ORDER.indexOf(r.evidenceGrade);
    if (idx > bestIdx) bestIdx = idx;
  }
  return bestIdx === -1 ? null : EVIDENCE_GRADE_ORDER[bestIdx]!;
}
