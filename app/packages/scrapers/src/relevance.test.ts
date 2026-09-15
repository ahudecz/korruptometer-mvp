import { describe, expect, it } from 'vitest';
import { isRelevant, scrapeRelevanceTier, isForeignOrJunk, isBreaking, shouldFeature } from './relevance';

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

describe('isRelevant — resign-watchlist trigger words', () => {
  // 2026-07-13, hvg.hu: "Hegedűs Zsolt: Kórházvezetői megbízásokat vont
  // vissza az OKFŐ" — az igekötő-hátravetés miatt ("vont vissza", nem
  // "visszavonta") a puszta 'visszavon' substring nem lett volna elég.
  it('catches split-preverb "vont vissza" wording for a watchlisted name', () => {
    expect(
      isRelevant(
        'Hegedűs Zsolt: Kórházvezetői megbízásokat vont vissza az OKFŐ',
        'Kórházvezetői megbízásokat vont vissza az Országos Kórházi Főigazgatóság (OKFŐ) – közölte Hegedűs Zsolt egészségügyi miniszter.',
      ),
    ).toBe(true);
  });

  it('catches the fused "visszavonta" wording via the OKFŐ institution keyword alone', () => {
    expect(
      isRelevant(
        'Két kórházi vezető megbízását is visszavonta az OKFŐ',
        'Az újonnan kinevezett főigazgató visszavonta a gazdasági igazgató megbízását.',
      ),
    ).toBe(true);
  });
});

describe('isRelevant — substring false positives (2026-07-15)', () => {
  // 'kelet-magyarország' (KESMA-napilap) korábban elkapta a "kelet-
  // magyarországi" földrajzi jelzőt is — egy vasvillával autókat rongáló
  // férfiról szóló 444-es bűnügyi hír emiatt jutott át a szűrőn.
  it('does not match the generic "kelet-magyarországi" geographic adjective', () => {
    expect(
      isRelevant(
        'Vasvillával esett neki autóknak a kelet-magyarországi férfi, a kiérkező rendőrt pedig megharapta',
        'Sokkolóval kellett földre vinni.',
      ),
    ).toBe(false);
  });

  // 'nka ' (NKA) korábban elkapta a "munka" szót is (mestermunka volt) — egy
  // Mbappé elleni spanyol védekezésről szóló 444-es sportcikk emiatt jutott át.
  it('does not match "munka" as a false positive for NKA', () => {
    expect(
      isRelevant('Taktikai mestermunka volt, ahogy a spanyolok hatástalanították Mbappéékat', ''),
    ).toBe(false);
  });

  it('still matches real NKA mentions', () => {
    expect(isRelevant('Botrány az NKA körül', 'Az NKA-nál visszaélésekre derült fény.')).toBe(true);
    expect(isRelevant('Az NKA pályázatai', '')).toBe(true);
  });

  it('shouldFeature also does not match "munka" as a false positive for NKA', () => {
    expect(
      shouldFeature('Taktikai mestermunka volt, ahogy a spanyolok hatástalanították Mbappéékat', ''),
    ).toBe(false);
  });

  // A generikus szóhatár-fix mellékesen egy MÁSIK, korábban észrevétlen
  // ütközést is kijavít: 'ligeti' (Ligeti Miklós, Transparency) illeszkedett
  // a "Városligeti" szó belsejébe is (Városliget/Városligeti fasor stb. —
  // teljesen más téma, semmi köze Ligeti Miklóshoz).
  it('does not match "Városligeti" as a false positive for the "ligeti" keyword', () => {
    expect(isRelevant('Megújul a Városligeti Nagycirkusz', 'Jövőre nyit az új épület.')).toBe(false);
    expect(shouldFeature('Megújul a Városligeti Nagycirkusz', 'Jövőre nyit az új épület.')).toBe(false);
  });

  it('still matches real "ligeti" mentions (word-initial or suffixed)', () => {
    expect(isRelevant('Ligeti Miklós nyilatkozott', '')).toBe(true);
    expect(isRelevant('', 'Ligeti szerint korrupció történt')).toBe(true);
  });

  // A szóhatár-fix jobb oldalon szándékosan nem szigorít, hogy a magyar
  // toldalékolás (pl. "Orbán Viktort", "fideszes") ne törjön el.
  it('still matches Hungarian suffixed/inflected forms (right side stays open)', () => {
    expect(isRelevant('Orbán Viktort bírálta a sajtó', '')).toBe(true);
    expect(isRelevant('Egy fideszes politikus nyilatkozott', '')).toBe(true);
  });

  // 2026-07-26 — 'világgazdaság' (a KESMA-lap neve) elkapta a köznévi
  // "világgazdaságra" szót is egy iráni-húszi tanker-támadásról szóló,
  // teljesen külföldi Telex-cikkben ("...ijesztettek rá a világgazdaságra
  // az iráni háború régi-új frontján..."), amely emiatt átjutott a szűrőn
  // ÉS kiemelt hír is lett — pedig a /kulfold/ URL-szekció miatt
  // isForeignOrJunk() kidobta volna, ha isRelevant() nem előzi meg.
  it('does not match "világgazdaságra" as a false positive for the KESMA outlet name', () => {
    const headline = 'Lángoló tankerrel ijesztettek rá a világgazdaságra az iráni háború régi-új frontján';
    const excerpt = 'A húszik blokád alá vonták a Vörös-tenger egyik kulcsfontosságú szorosát.';
    expect(isRelevant(headline, excerpt)).toBe(false);
    expect(shouldFeature(headline, excerpt)).toBe(false);
    expect(isForeignOrJunk(headline, excerpt, 'https://telex.hu/kulfold/2026/07/26/valami')).toBe(true);
  });

  it('still matches real "Világgazdaság" outlet mentions in a media-closure context', () => {
    expect(isRelevant('Leépítés a Világgazdaságnál', 'Több újságírót is elküldött a szerkesztőség.')).toBe(true);
    expect(shouldFeature('Leépítés a Világgazdaságnál', 'Több újságírót is elküldött a szerkesztőség.')).toBe(true);
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

describe('isBreaking', () => {
  it('does not flag an unrelated headline just because a monitored name appears in the excerpt (iskolakezdési támogatás false-positive)', () => {
    const headline = 'Elindult az iskolakezdési támogatás igénylése';
    const excerpt =
      'A kormányinfón Sulyok Tamás is jelen volt, amikor bejelentették, hogy házkutatás során derült fény egy másik ügyre.';
    expect(isBreaking(headline, excerpt)).toBe(false);
  });

  it('flags when a monitored (WATCH_LIST) name is in the headline together with a trigger phrase', () => {
    expect(isBreaking('Sulyok Tamást házkutatás közben érték', 'részletek a cikkben')).toBe(true);
  });

  it('flags when a monitored (GALERIA) name is in the headline together with a trigger phrase', () => {
    expect(isBreaking('Orbán Viktort őrizetbe vették', 'részletek a cikkben')).toBe(true);
  });

  it('flags when a monitored ügy keyword is in the headline together with a trigger phrase', () => {
    expect(isBreaking('Aranykonvoj-ügy: vádat emeltek', 'részletek a cikkben')).toBe(true);
  });

  it('does not flag a headline with a trigger phrase but no monitored name/keyword', () => {
    expect(isBreaking('Egy helyi vállalkozót őrizetbe vettek', 'adócsalás gyanúja miatt')).toBe(false);
  });

  it('does not flag a headline with a monitored name but no trigger phrase', () => {
    expect(isBreaking('Orbán Viktor új bejelentése', 'a kormányfő beszédet mondott')).toBe(false);
  });

  it('does not flag a stale name that was removed from the monitored list', () => {
    expect(isBreaking('Czeglédy Csabát őrizetbe vették', 'részletek a cikkben')).toBe(false);
  });
});
