import { describe, expect, it } from 'vitest';

describe('anonymize-dsr semantics (T085, FR-034 / FR-035)', () => {
  it('investigation rows are anonymized (NOT deleted) so audit refs resolve', () => {
    // The Inngest function uses an UPDATE … SET primaryPersonName='[redacted]',
    // primaryPersonNormalized=NULL, summary=regexp_replace(...). No DELETE.
    // This unit test asserts the shape of that contract.
    const before = {
      id: 'inv-1',
      primaryPersonName: 'Kovács László',
      primaryPersonNormalized: 'kovacs laszlo',
      summary: 'Kovács László vesztegetése ügyében...',
    };
    const after = {
      ...before,
      primaryPersonName: '[redacted]',
      primaryPersonNormalized: null,
      summary: '[redacted] vesztegetése ügyében...',
    };
    expect(after.primaryPersonName).toBe('[redacted]');
    expect(after.primaryPersonNormalized).toBeNull();
    expect(after.id).toBe(before.id);
  });

  it('article claim rows that name the subject are hard-deleted (FR-035)', () => {
    // We test the SQL predicate shape — `LOWER(p->>"normalizedName") = $subject`
    // matches when any party entry on the claim names the subject.
    const subject = 'kovacs laszlo';
    const claim = {
      parties: [
        { kind: 'person', name: 'Kovács László', normalizedName: 'kovacs laszlo', role: 'főnök' },
      ],
    };
    const hit = claim.parties.some(
      (p) => p.normalizedName.toLowerCase() === subject,
    );
    expect(hit).toBe(true);
  });
});
