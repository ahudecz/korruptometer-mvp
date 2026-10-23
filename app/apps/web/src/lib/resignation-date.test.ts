import { describe, expect, it } from 'vitest';
import { resolveResignationDate } from './resignation-date';

const article = new Date('2026-10-15T09:30:00Z');

describe('resolveResignationDate', () => {
  it('a cikk utáni dátum (hatálybalépés) helyett a cikk napja — Börcsök-eset', () => {
    expect(resolveResignationDate('2027-06-14', article)).toEqual(article);
  });

  it('a cikk előtti vagy aznapi döntési dátum megmarad', () => {
    expect(resolveResignationDate('2026-10-14', article).toISOString().slice(0, 10)).toBe('2026-10-14');
    expect(resolveResignationDate('2026-10-15', article).toISOString().slice(0, 10)).toBe('2026-10-15');
  });

  it('másnapi dátum még elfogadott (időzóna-csúszás)', () => {
    expect(resolveResignationDate('2026-10-16', article).toISOString().slice(0, 10)).toBe('2026-10-16');
  });

  it('hiányzó vagy érvénytelen dátumnál a cikk napja', () => {
    expect(resolveResignationDate(undefined, article)).toEqual(article);
    expect(resolveResignationDate('nem dátum', article)).toEqual(article);
  });
});
