import 'server-only';

import type { DamageCitation } from '@korr/shared';

/**
 * Frozen citation tuples used by the damage estimator's `industry_estimate`
 * components (FR-043, FR-044). The percentile ranges are stored alongside
 * the citation so the `formula` string in DamageComponent.inputs renders the
 * same numbers the caller uses for the math — no drift between display and
 * arithmetic.
 *
 * last-verified: 2026-05-19
 *
 * Drift surveillance: a placeholder nightly job pings each `sourceUrl` and
 * emits a Sentry breadcrumb on a 4xx/5xx response. Editing this file is the
 * only way to update a published heuristic; the addendum's Assumptions §
 * mandates an entry in spec.md Clarifications and counsel re-sign-off before
 * a change ships.
 */

export type DamageCitationEntry = DamageCitation & {
  /** Low end of the empirical range, as a fraction of contract value. */
  lowFrac: number;
  /** High end of the empirical range, as a fraction of contract value. */
  highFrac: number;
};

export const OECD_2022_SINGLE_BIDDER_PREMIUM: DamageCitationEntry = {
  studyId: 'OECD-2022-single-bidder-premium',
  sourceUrl:
    'https://www.oecd.org/governance/public-procurement/',
  lastVerifiedAt: '2026-05-19',
  lowFrac: 0.05,
  highFrac: 0.15,
};

export const WB_GOVT_CORRUPTION_STUDY: DamageCitationEntry = {
  studyId: 'WB-government-corruption-study',
  sourceUrl:
    'https://www.worldbank.org/en/topic/governance/brief/anti-corruption',
  lastVerifiedAt: '2026-05-19',
  lowFrac: 0.05,
  highFrac: 0.15,
};

export const CITATIONS = {
  single_bidder: OECD_2022_SINGLE_BIDDER_PREMIUM,
  no_bid: OECD_2022_SINGLE_BIDDER_PREMIUM,
  related_party: WB_GOVT_CORRUPTION_STUDY,
} as const;

export type CitationKey = keyof typeof CITATIONS;

/**
 * Returns the citation tuple in the shape the wire DTO expects. Strips the
 * `lowFrac`/`highFrac` fields — those are math inputs, not display facts.
 */
export function citationDto(entry: DamageCitationEntry): DamageCitation {
  return {
    studyId: entry.studyId,
    sourceUrl: entry.sourceUrl,
    lastVerifiedAt: entry.lastVerifiedAt,
  };
}
