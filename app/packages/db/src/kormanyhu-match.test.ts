import { describe, expect, it } from 'vitest';
import { isLikelyMatch, looksGovernmentFiled, mapOfficialStatus, matchStrength, textMatchScore, urlSlugMatchScore } from './kormanyhu-match';

describe('textMatchScore / isLikelyMatch — kormany.hu egyeztetés', () => {
  it('high score for genuinely the same case, differently worded', () => {
    const score = textMatchScore(
      'Egyiptomi Államvasutak (ENR) - 1300 vasúti kocsi beszerzése (EXIM bank)',
      'Dunakeszi Járműjavító — egyiptomi vasúti kocsik (Eximbank-hitel)',
    );
    expect(score).toBeGreaterThan(0.3);
  });

  it('low score for two unrelated cases', () => {
    const score = textMatchScore(
      'Kárpát-medencei Tehetséggondozó Nonprofit Kft.',
      'Triton Communications — Orbán Viktor közösségi médiás tartalomgyártása',
    );
    expect(score).toBeLessThan(0.3);
  });

  // 2026-08-30 — real incident: word-overlap alone missed this; the URL
  // channel caught it (both source URLs contain "jatekmotor").
  it('url-slug overlap catches a match that word-overlap alone would miss (Kismotor/Játékmotor incident)', () => {
    const textScore = textMatchScore('Kismotor-megrendelés', 'Játékmotor-beszerzések - túlárazás gyanúja');
    expect(textScore).toBeLessThan(0.3); // confirms the word-overlap gap actually exists
    const urlScore = urlSlugMatchScore(
      'https://24.hu/belfold/2026/06/15/jatekmotor-rendorseg-nyomozas-nyuszom',
      ['https://hvg.hu/itthon/20260819_jatekmotor-beszerzes-balasy-gyula-kulturalis-es-innovacios-miniszterium-hutlen-kezeles-gyanuja-nyomozas'],
    );
    expect(urlScore).toBeGreaterThan(0.4);
    expect(isLikelyMatch(
      'Kismotor-megrendelés',
      'https://24.hu/belfold/2026/06/15/jatekmotor-rendorseg-nyomozas-nyuszom',
      'Játékmotor-beszerzések - túlárazás gyanúja',
      ['https://hvg.hu/itthon/20260819_jatekmotor-beszerzes-balasy-gyula-kulturalis-es-innovacios-miniszterium-hutlen-kezeles-gyanuja-nyomozas'],
    )).toBe(true);
  });

  it('isLikelyMatch is false when neither channel clears its threshold', () => {
    expect(isLikelyMatch(
      'Kárpát-medencei Tehetséggondozó Nonprofit Kft.',
      'https://kormany.hu/atlathato/feljelentes',
      'Triton Communications — Orbán Viktor közösségi médiás tartalomgyártása',
      ['https://telex.hu/belfold/2026/08/11/orban-viktor-kozossegi-media'],
    )).toBe(false);
  });
});

describe('matchStrength — live sync egyeztetés (2026-08-30-i regresszió, dry-run-nel talált hibák)', () => {
  // A generikus korrupciós-doménszavak ("állami", "támogatás") önmagukban
  // átbillentették a küszöböt két TELJESEN független ügy között — a "Fradi"
  // sor 4 más hivatalos tételt is "ellopott" volna élesben.
  it('does not match two unrelated cases just because both mention "állami támogatás"', () => {
    const official = {
      name: 'Kárpát-medencei Tehetséggondozó Nonprofit Kft.',
      description: 'A Társadalmi Kapcsolatok és Kultúra Minisztérium feljelentést tett a Kárpát-medencei Tehetséggondozó Nonprofit Kft.-nek juttatott állami támogatás ügyében.',
      url: 'https://kormany.hu/atlathato/feljelentes',
    };
    const candidate = {
      name: 'FTC Fradiváros-projekt — 25 milliárdos állami támogatás felhasználása',
      description: 'Feljelentés az FTC Fradiváros-projektjére adott csaknem 25 milliárd forintos állami támogatás felhasználása miatt.',
      urls: ['https://444.hu/2026/08/28/kubatov-gabor-a-fradivarost-erinto-feljelentesrol-a-lelkiismeretunk-tiszta'],
    };
    expect(matchStrength(official, candidate)).toBeLessThan(1);
  });

  // Az átláthatósági LISTAOLDAL saját URL-je (nincs konkrét cikk) rengeteg
  // tételnél és sorunknál egyaránt előfordul forrásként — ha ezt engednénk
  // path-szó-egyezésnek számítani, bármelyik ilyen tétel bármelyik ilyen
  // sorral "egyezne". Élesben: "Gondosóra program" ellopta volna az OMSZ-sort.
  it('ignores the bare átláthatósági listaoldal URL as a matching signal', () => {
    const official = {
      name: 'Gondosóra program',
      description: 'A jelzőkészülék-program beszerzése.',
      url: 'https://kormany.hu/atlathato/feljelentes',
    };
    const candidate = {
      name: 'OMSZ mentőjármű-beszerzések',
      description: 'Az Egészségügyi Minisztérium feljelentést tett az Országos Mentőszolgálat mentőjármű-beszerzései ügyében — a kormany.hu átláthatósági oldala szerint.',
      urls: ['https://kormany.hu/atlathato/feljelentes'],
    };
    expect(matchStrength(official, candidate)).toBeLessThan(1);
  });

  // A leírás gyakran sokkal hosszabb/narratívabb, mint a név, ami a
  // teljes-szöveges arányt egy egyébként egyértelmű egyezésnél is a küszöb
  // alá higíthatja (mért: 0.29 a 0.3-as küszöb alatt) — a NÉV-csak
  // összevetésnek (0.57) kell megmentenie ezt az egyezést.
  it('rescues a genuine match via name-only score when the full-text ratio is diluted by a long description', () => {
    const official = {
      name: 'Egyiptomi Államvasutak (ENR) - 1300 vasúti kocsi beszerzése (EXIM bank)',
      description: 'Eximbank Egyiptomi Államvasutak (ENR) - 1300 vasúti kocsi beszerzése. A beszerzésre vállalt kockázat túl magas, lévén, hogy a projektet megvalósító cégek felszámolás alá kerültek, a szerződések sorsa bizonytalan, és a többéves csúszás miatt az egyiptomi fél akár kártérítést is követelhet.',
      url: 'https://kormany.hu/hirek/1000-milliard-forintos-gyanus-ugyek-miatt-tett-feljelentest-a-gazdasagi-es-energetikai-miniszterium',
    };
    const candidate = {
      name: 'Dunakeszi Járműjavító — egyiptomi vasúti kocsik (Eximbank-hitel)',
      description: 'A GEM feljelentést tett a Dunakeszi Járműjavítót érintő, 176 milliárd forintos állami hitelből finanszírozott egyiptomi vasúti kocsi projekt (magyar-orosz konzorcium, MÁV) ügyében — hűtlen és hanyag kezelés, valamint csőd gyanújával.',
      urls: ['https://telex.hu/belfold/2026/07/23/miniszteriumi-feljelentes-negy-ugy-eximbank-macedonia-zambia'],
    };
    expect(matchStrength(official, candidate)).toBeGreaterThanOrEqual(1);
  });

  // "Támogatással visszaélés" — a hivatalos név KIZÁRÓLAG generikus
  // korrupciós-doménszóból áll (tamogatassal, visszaeles), a normalizeWords
  // mindent kiszűr belőle, a szó-alapú pontszám ezért mindig 0 marad, MÉG
  // NÉV-NÉV EGYEZÉS ESETÉN IS. Enélkül ez az egy tétel minden nap újra
  // beszúrásra kerülne (élesben derült ki, 2026-08-30).
  it('falls back to substring match when the official name is entirely generic stopword vocabulary', () => {
    const official = {
      name: 'Támogatással visszaélés',
      description: 'Támogatási kérelemmel kapcsolatos visszaélés.',
      url: 'https://kormany.hu/atlathato/feljelentes',
    };
    const candidate = {
      name: 'Támogatással visszaélés (MÁK)',
      description: 'A Pénzügyminisztérium (Magyar Államkincstár) feljelentést tett támogatással való visszaélés gyanúja miatt.',
      urls: ['https://kormany.hu/atlathato/feljelentes'],
    };
    expect(matchStrength(official, candidate)).toBeGreaterThanOrEqual(1);
  });

  it('does not let a short/generic name fragment cause an accidental substring match', () => {
    const official = { name: 'Kft.', description: 'Feljelentés.', url: 'https://kormany.hu/atlathato/feljelentes' };
    const candidate = { name: 'Teljesen más ügy Kft. érintettséggel', description: '', urls: [] };
    expect(matchStrength(official, candidate)).toBeLessThan(1);
  });
});

describe('looksGovernmentFiled', () => {
  it('true for ministry/government-style filer names', () => {
    expect(looksGovernmentFiled('Gazdasági és Energetikai Minisztérium')).toBe(true);
    expect(looksGovernmentFiled('Miniszterelnökség')).toBe(true);
    expect(looksGovernmentFiled('Kormány')).toBe(true);
    expect(looksGovernmentFiled('a kormány')).toBe(true);
  });

  it('false for third-party filers (not our reconciliation scope)', () => {
    expect(looksGovernmentFiled('Hadházy Ákos')).toBe(false);
    expect(looksGovernmentFiled('Transparency International')).toBe(false);
    expect(looksGovernmentFiled('Állami Számvevőszék (ÁSZ)')).toBe(false);
    expect(looksGovernmentFiled('Integritás Hatóság')).toBe(false);
  });
});

describe('mapOfficialStatus', () => {
  it('maps positive investigation language to nyomozás', () => {
    expect(mapOfficialStatus('a Készenléti Rendőrség Nemzeti Nyomozó Iroda 07. 30-án elrendelte a nyomozást')).toBe('nyomozás');
    expect(mapOfficialStatus('elrendelték a nyomozást')).toBe('nyomozás');
    expect(mapOfficialStatus('a büntetőeljárás megindult (07. 14-i tájékoztatás)')).toBe('nyomozás');
  });

  // 2026-08-30 — the actual bug this test guards against: "nincs információ
  // A NYOMOZÓ SZERV eljárásáról" contains the word "nyomozó" but means the
  // OPPOSITE (no investigation info exists) — order-of-checks matters.
  it('does NOT map "nincs adat/infó a nyomozó szerv eljárásáról" to nyomozás', () => {
    expect(mapOfficialStatus('nincs információ a nyomozó szerv eljárásáról')).toBe('feljelentés');
    expect(mapOfficialStatus('nincs adat a nyomozó szerv eljárásáról')).toBe('feljelentés');
  });

  // 2026-08-30 — user report: a "Tartalom Előkészítő Osztály" ügy tévesen
  // 'elutasítva' státuszban jelent meg, pedig a leírás csak annyit mondott,
  // hogy "nem indult nyomozás" — ez a feljelentés még folyamatban/függőben
  // lévő státuszát jelenti, NEM elutasítást. Explicit elutasítás-szó kell
  // (pl. "elutasította", "elévült") ahhoz, hogy 'elutasítva' legyen.
  it('maps "nem indult" to feljelentés (pending), NOT elutasítva, even though it also contains "nyomozás"', () => {
    expect(mapOfficialStatus('nyomozás még nem indult, az ügy a BRFK-nál')).toBe('feljelentés');
    expect(mapOfficialStatus('A feljelentés nyomán nem indult nyomozás.')).toBe('feljelentés');
  });

  it('maps explicit rejection language to elutasítva', () => {
    expect(mapOfficialStatus('az ügyészség elutasította a feljelentést')).toBe('elutasítva');
    expect(mapOfficialStatus('az ügy időközben elévült')).toBe('elutasítva');
  });

  it('falls back to feljelentés for null or unrecognized text', () => {
    expect(mapOfficialStatus(null)).toBe('feljelentés');
    expect(mapOfficialStatus('feljelentés-kiegészítés 08. 11-én')).toBe('feljelentés');
  });
});
