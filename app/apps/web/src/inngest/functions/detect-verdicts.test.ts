import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { VERDICT_KEYWORDS } from './detect-verdicts';

function matchesKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return VERDICT_KEYWORDS.some((kw) => lower.includes(kw));
}

describe('VERDICT_KEYWORDS pre-filter', () => {
  // 2026-07-08 — Szakács István-eset (see file header comment): a
  // korábban letartóztatott személy kiengedéséről szóló cikkek egyike sem
  // tartalmazott letartóztatás-szót, csak a "kiengedt" családba tartozó
  // kifejezéseket, amik akkor még hiányoztak a listából.
  it('catches the Szakács István release headline (2026-07-08 miss)', () => {
    expect(matchesKeywords('Kiengedték Szakács Istvánt')).toBe(true);
  });

  it('catches pretrial-detention and charge phrasing', () => {
    expect(matchesKeywords('Előzetes letartóztatásba került az üzletember')).toBe(true);
    expect(matchesKeywords('Vádemelés történt az ügyben')).toBe(true);
    expect(matchesKeywords('Gyanúsítottként hallgatták ki')).toBe(true);
  });

  it('catches pre-arrest phase phrasing (őrizetbe, házkutatás, razzia, körözik, elfogatóparancs)', () => {
    expect(matchesKeywords('Őrizetbe vették a polgármestert')).toBe(true);
    expect(matchesKeywords('Házkutatást tartottak a lakásán')).toBe(true);
    expect(matchesKeywords('Razziát tartott a rendőrség')).toBe(true);
    expect(matchesKeywords('Körözik az egykori vezetőt')).toBe(true);
    expect(matchesKeywords('Elfogatóparancsot adtak ki ellene')).toBe(true);
  });

  it('catches verdict and release-from-case phrasing', () => {
    expect(matchesKeywords('Jogerős ítélet született az ügyben')).toBe(true);
    expect(matchesKeywords('Megszüntették az eljárást')).toBe(true);
    expect(matchesKeywords('Ejtette a vádat az ügyészség')).toBe(true);
    expect(matchesKeywords('Felmentették a vádak alól')).toBe(true);
  });

  it('catches the megafon entity-marker keyword', () => {
    expect(matchesKeywords('A Megafonhoz köthető üzletember ügye')).toBe(true);
  });

  it('does not match unrelated headlines', () => {
    expect(matchesKeywords('Megnyílt egy új étterem a belvárosban')).toBe(false);
  });
});
