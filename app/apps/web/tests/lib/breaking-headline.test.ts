import { describe, it, expect } from 'vitest';
import { condenseBreakingHeadline, MAX_BREAKING_WORDS } from '@/lib/breaking-headline';

const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Valódi prod-headline-ok: a 2026-09-10-i állapotban EZ a 7 breaking-jelölt
 *  lépte túl a 20 szót az elmúlt 90 napban (208-ból). A teszt ezeken méri a
 *  tömörítőt, nem kitalált mondatokon. */
const REAL_HEADLINES = [
  'A Kontroll információi szerint a Készenléti Rendőrség Nemzeti Nyomzó Irodája kihallgatásra idézett be ma 8 embert az öt éve húzódó Volánbusz-ügyben. Úgy tudjuk, idézést kapott Szivek Norbert, a Nemzeti Vagyonkezelő Zrt. volt vezérigazgatója és Jellinek Dániel milliárdos ingatlanvállalkozó, Tiborcz István korábbi rendszeres üzletfele is. A Volánbusz-ügyben még 2021-ben érkezett feljelentés az NNI-hez, de az azóta húzódó nyomozás során még nem gyanúsítottak meg senkit.',
  'Több helyszínen, köztül Balásy Gyula cégeinél tartott házkutatást a Készenléti Rendőrség Nemzeti Nyomozó Iroda a Hankó féle Kulturális és Innovációs Minisztérium több mint 200 millió forintos „nyuszimotoros” beszerzése ügyében.',
  'Tanács Zoltánék találtak egy szerződést, ami arról szólt, hogy a Fidesz a kampány idején megkapta a Gondosóra-program idős résztvevőinek az adatait',
  'Az államalapítás ünnepén lemondott országgyűlési képviselői mandátumáról a Fidesz meghatározó politikusa. Lázár János egyelőre csak a parlamenti politizálással hagy fel, akinek az idő előtti távozására számos közéleti szereplő reagált.',
  'A NAV bűncselekmény hiányában megszüntette az aranykonvoj-ügyben pénzmosás miatt indított nyomozást. Ezzel viszont új kérdések kerülhetnek előtérbe: jogszerűen jártak-e el a rajtaütésben részt vevő hatóságok.',
  'Baka András a Legfelső Bíróság elnökeként szembement a hatalommal, ami eltávolította helyéről. Pert nyert az állam ellen, most a Tisza köztársasági elnököt csinált belőle.',
  'Kollégáira vallott és beismerő vallomást tett a Szőlő utcai javítóintézet volt rendészeti vezetője, aki véresre verte és még a betegágyán is bántotta áldozatát',
];

describe('condenseBreakingHeadline', () => {
  it('leaves a headline that already fits completely untouched', () => {
    const short = 'Letartóztatták az NKA-botrány hetedik gyanúsítottját';
    expect(condenseBreakingHeadline(short)).toEqual({ text: short, needsRewrite: false });
  });

  it('keeps every real prod headline within the 20-word cap', () => {
    for (const h of REAL_HEADLINES) {
      const { text } = condenseBreakingHeadline(h);
      expect(wc(text), `túl hosszú maradt: ${text}`).toBeLessThanOrEqual(MAX_BREAKING_WORDS);
    }
  });

  // A user kifejezett kérése: "nehogy azt csináld, hogy bemásolod a címet és
  // 20 szónál levágod". A kimenet ezért mindig teljes tagmondat: nem végződhet
  // vesszőn, kötőszón, névelőn vagy elöljárón.
  it('never ends mid-clause — no dangling article, conjunction or comma', () => {
    const DANGLING = /(?:[,;:]|\b(?:a|az|és|vagy|de|hogy|ami|amely|aki|mint|több|szerint)\s*)$/iu;
    for (const h of REAL_HEADLINES) {
      const { text } = condenseBreakingHeadline(h);
      expect(text, `csonkán végződik: ${text}`).not.toMatch(DANGLING);
    }
  });

  it('never invents words — every output word comes from the source headline', () => {
    for (const h of REAL_HEADLINES) {
      const { text } = condenseBreakingHeadline(h);
      const source = h.toLowerCase();
      for (const w of text.toLowerCase().split(/\s+/)) {
        // az első szó nagybetűsítése az egyetlen megengedett módosítás
        expect(source.includes(w), `nem a forrásból való szó: ${w}`).toBe(true);
      }
    }
  });

  it('drops the source attribution prefix, which the banner link already conveys', () => {
    const { text } = condenseBreakingHeadline(REAL_HEADLINES[0]!);
    expect(text).not.toMatch(/Kontroll információi szerint/i);
    expect(text).toContain('Volánbusz-ügyben');
    expect(text.startsWith('A Készenléti Rendőrség')).toBe(true);
  });

  it('drops a trailing adverbial phrase before it drops the actor', () => {
    // "… tartott házkutatást a Nemzeti Nyomozó Iroda [a … beszerzése ügyében]"
    // — a cselekvőnek benne kell maradnia, a hátravetett bővítménynek nem.
    const { text } = condenseBreakingHeadline(REAL_HEADLINES[1]!);
    expect(text).toContain('Nemzeti Nyomozó Iroda');
    expect(text).not.toMatch(/ügyében/);
  });

  it('drops a subordinate clause rather than leaving it hanging', () => {
    const { text } = condenseBreakingHeadline(REAL_HEADLINES[2]!);
    expect(text).toBe('Tanács Zoltánék találtak egy szerződést');
    expect(text).not.toMatch(/ami arról szólt/);
  });

  it('flags needsRewrite when even the trimmed sentence cannot fit', () => {
    // Egyetlen, vessző és hátravetett bővítmény nélküli, 24 szavas mondat —
    // itt nincs mit elhagyni, valódi átfogalmazás kellene.
    const stubborn = Array.from({ length: 24 }, (_, i) => `szó${i + 1}`).join(' ');
    const r = condenseBreakingHeadline(stubborn);
    expect(r.needsRewrite).toBe(true);
    // ilyenkor sem vág szó közepén: a teljes mondatot adja vissza
    expect(r.text).toBe(stubborn);
  });

  it('handles empty input without throwing', () => {
    expect(condenseBreakingHeadline('')).toEqual({ text: '', needsRewrite: false });
  });
});
