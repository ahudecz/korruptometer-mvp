import { describe, expect, it } from 'vitest';
import { findOutletLogo } from './media-config';

describe('findOutletLogo', () => {
  it('matches an exact name', () => {
    expect(findOutletLogo('Promenad24')?.id).toBe('promenad24');
    expect(findOutletLogo('Megafon')?.id).toBe('megafon');
  });

  it('matches a MediaClosure name with a descriptive suffix the outlet list does not have', () => {
    expect(findOutletLogo('24 Óra – Komárom-Esztergom (nyomtatott)')?.id).toBe('24-ora');
    expect(findOutletLogo('Heves Megyei Hírlap (nyomtatott)')?.id).toBe('heves-hirlap');
    expect(findOutletLogo('Nógrád Megyei Hírlap (nyomtatott)')?.id).toBe('nograd-hirlap');
    expect(findOutletLogo('Bors (nyomtatott)')?.id).toBe('bors');
    expect(findOutletLogo('Ripost (weboldal)')?.id).toBe('ripost');
    expect(findOutletLogo('Metropol (weboldal)')?.id).toBe('metropol');
    expect(findOutletLogo('Mandiner — 60 újságíró elbocsátva')?.id).toBe('mandiner');
    expect(findOutletLogo('Győr Plusz Média')?.id).toBe('gyor-plusz');
    expect(findOutletLogo('Fair Right (Varga Ádám & Vincze Emília)')?.id).toBe('fair-right');
    expect(findOutletLogo('Harcosok órája / Igazság órája')?.id).toBe('igazsag-oraja');
  });

  it('picks the longer/more specific outlet name over a coincidental shorter substring', () => {
    // "Tények" must win over the unrelated "TV2" outlet that also appears in the string.
    expect(findOutletLogo('Tények (TV2)')?.id).toBe('tenyek');
    // "Pesti Srácok" (online) must win, not the longer "Pesti Srácok Magazin" (print).
    expect(findOutletLogo('Pesti Srácok')?.id).toBe('pesti-sracok');
  });

  it('falls back to the (shorter) outlet name via reverse containment when the closure name has no suffix', () => {
    expect(findOutletLogo('Világgazdaság')).toBeDefined();
  });

  it('returns undefined for institutions/events with no corresponding outlet', () => {
    expect(findOutletLogo('Szuverenitásvédelmi Hivatal')).toBeUndefined();
    expect(findOutletLogo('MCC Feszt')).toBeUndefined();
    expect(findOutletLogo('KEKVA-alapítványok')).toBeUndefined();
  });
});
