import { describe, expect, it } from 'vitest';
import { isLikelyMatch, looksGovernmentFiled, mapOfficialStatus, textMatchScore, urlSlugMatchScore } from './kormanyhu-match';

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

  it('maps "nem indult" to elutasítva even though it also contains "nyomozás"', () => {
    expect(mapOfficialStatus('nyomozás még nem indult, az ügy a BRFK-nál')).toBe('elutasítva');
  });

  it('falls back to feljelentés for null or unrecognized text', () => {
    expect(mapOfficialStatus(null)).toBe('feljelentés');
    expect(mapOfficialStatus('feljelentés-kiegészítés 08. 11-én')).toBe('feljelentés');
  });
});
