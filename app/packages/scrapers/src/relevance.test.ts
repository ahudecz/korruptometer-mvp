import { describe, expect, it } from 'vitest';
import { scrapeRelevanceTier, isForeignOrJunk } from './relevance';

describe('scrapeRelevanceTier', () => {
  it('"in" for a strong Hungarian-political keyword (free, no AI)', () => {
    expect(scrapeRelevanceTier('Orbán Viktor új bejelentése', '', 'https://telex.hu/belfold/x', true)).toBe('in');
    expect(scrapeRelevanceTier('Rogán Antal vagyonáról szóló cikk', '', 'https://atlatszo.hu/x', true)).toBe('in');
  });

  it('"out" for foreign sections / junk (free, no AI)', () => {
    // a user valós fail-példái
    expect(scrapeRelevanceTier('Szerbia: Vučić lemondását követelik', '', 'https://telex.hu/kulfold/2026/06/29/szerbia-vucic', false)).toBe('out');
    expect(scrapeRelevanceTier('Elindultak Venezuelába a baptisták', '', 'https://hang.hu/kulfold/venezuela', true)).toBe('out');
    expect(scrapeRelevanceTier('Az izraeli kormány elismerte az örmény népirtást', '', 'https://hang.hu/kulfold/izrael', true)).toBe('out');
  });

  it('"maybe" for a trusted broad outlet with no clear keyword (only this hits the AI)', () => {
    expect(scrapeRelevanceTier('Kisteherautót lopott egy 15 éves fiú', '', 'https://hang.hu/belfold/auto-lopas', true)).toBe('maybe');
  });

  it('"out" for a non-default outlet without any keyword (unchanged behavior)', () => {
    expect(scrapeRelevanceTier('Időjárás: jön a kánikula', '', 'https://example.hu/belfold/idojaras', false)).toBe('out');
  });
});

describe('isForeignOrJunk', () => {
  it('flags foreign URL sections', () => {
    expect(isForeignOrJunk('akármi', '', 'https://telex.hu/kulfold/x')).toBe(true);
    expect(isForeignOrJunk('akármi', '', 'https://hang.hu/sport/x')).toBe(true);
  });
  it('flags specific foreign markers in text', () => {
    expect(isForeignOrJunk('A szerb elnök, Vučić beszéde', '')).toBe(true);
  });
  it('does not flag normal Hungarian domestic content', () => {
    expect(isForeignOrJunk('Lemondott a polgármester', 'belföldi hír', 'https://telex.hu/belfold/x')).toBe(false);
  });
});
