import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { COMPLAINT_KEYWORDS } from './detect-criminal-complaints';

function matchesKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return COMPLAINT_KEYWORDS.some((kw) => lower.includes(kw));
}

describe('COMPLAINT_KEYWORDS pre-filter', () => {
  // The file header comment claims the 'feljelent' stem covers every
  // Hungarian inflection "verified empirically against live data" (spec
  // 009) — this test locks that claim in so a future keyword-list edit
  // can't silently narrow it back down to an exact-word match.
  it('catches every documented inflection of feljelent-', () => {
    expect(matchesKeywords('Feljelentést tett a rendőrségen')).toBe(true);
    expect(matchesKeywords('Feljelentette a volt üzlettársát')).toBe(true);
    expect(matchesKeywords('Feljelenti az önkormányzatot')).toBe(true);
    expect(matchesKeywords('Feljelentés érkezett az ügyészségre')).toBe(true);
  });

  it('does not match unrelated headlines', () => {
    expect(matchesKeywords('Megnyílt egy új étterem a belvárosban')).toBe(false);
  });
});
