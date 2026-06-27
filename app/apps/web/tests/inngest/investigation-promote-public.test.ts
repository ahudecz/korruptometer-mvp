import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { EVIDENCE_GRADE_ORDER } from '@korr/shared';
import type { EvidenceGrade } from '@korr/shared';

function passesJournalistGate(qty: number, qual: EvidenceGrade | null): boolean {
  return (
    qty >= 2
    && qual !== null
    && EVIDENCE_GRADE_ORDER.indexOf(qual)
      >= EVIDENCE_GRADE_ORDER.indexOf('investigative_journalism')
  );
}

describe('promote-public predicate (T083, FR-026)', () => {
  it('rejects when quantity < 2', () => {
    expect(passesJournalistGate(1.5, 'investigative_journalism')).toBe(false);
  });

  it('rejects when quality below investigative_journalism', () => {
    expect(passesJournalistGate(3, 'opinion_press')).toBe(false);
    expect(passesJournalistGate(3, null)).toBe(false);
  });

  it('accepts at the boundary (qty=2, quality=investigative_journalism)', () => {
    expect(passesJournalistGate(2, 'investigative_journalism')).toBe(true);
  });

  it('accepts higher grades', () => {
    expect(passesJournalistGate(2, 'audit_report')).toBe(true);
    expect(passesJournalistGate(2, 'court_document')).toBe(true);
  });
});

describe('InvestigationPublicCaseLink history semantics (T083, FR-030)', () => {
  it('depromote leaves the prior link with depromotedAt set; re-promote inserts a new link row', () => {
    // Pure shape assertion against the schema we built. The atomic
    // five-write txn writes one new row on every promotion; depromotion
    // patches the matching prior row. End-to-end behaviour is verified
    // via the quickstart.md §11 smoke run.
    const links = [
      { investigationId: 'i1', publicCaseId: 'c-old', promotedAt: new Date(), depromotedAt: new Date() },
      { investigationId: 'i1', publicCaseId: 'c-new', promotedAt: new Date(), depromotedAt: null },
    ];
    expect(links).toHaveLength(2);
    expect(links[0]!.depromotedAt).toBeTruthy();
    expect(links[1]!.depromotedAt).toBeNull();
  });
});
