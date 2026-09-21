import { describe, expect, it } from 'vitest';

import { lookupAmount, parseHufAmounts, pickAmountNearKeywords } from './money-lookup';

// A VALÓDI eset szövege, amiből a „0 Ft"-os poszt született (2026-09-18).
// A HVG-cikk nem közli a tőkét, a 444-é igen — a teljes törzsben.
const HVG_BODY =
  'Visszafizette az Exim Banknak és az MFB-nek a Kasomeno–Mwenda-projekthez kapcsolódó ' +
  'kötvények összegét, az összes, több mint 10 milliárd forint kamattal együtt a Duna Aszfalt. ' +
  'A kölcsön visszafizetésével lezárult a projekt közvetett állami finanszírozása.';

const F444_BODY =
  'A Gazdasági és Energetikai Minisztérium július végén négy Eximbank-ügy miatt tett feljelentést. ' +
  'A minisztérium akkor a következő tájékoztatást adta: „2025 novemberében 126 milliárd forintos ' +
  'kötvényfinanszírozást kapott az előző kormányzat idején sikeres építési vállalkozó, Szíjj László ' +
  'érdekeltségi körébe tartozó Duna Aszfalt egy afrikai projektje.” A finanszírozás 80 százalékára, ' +
  'vagyis nagyjából 101 milliárd forintra a magyar állam vállalt kezességet. ' +
  'A 182 kilométeres út megépítése a tervek szerint 125 milliárd forintba kerül. ' +
  'A kötvény névértéke 400 millió dollár volt.';

describe('parseHufAmounts', () => {
  it('forintra vált, és a devizát kihagyja', () => {
    const hits = parseHufAmounts(F444_BODY);
    const values = hits.map((h) => h.ft);
    expect(values).toContain(126_000_000_000);
    expect(values).toContain(101_000_000_000);
    expect(values).toContain(125_000_000_000);
    // 400 millió DOLLÁR — nem forint, nem kerülhet be.
    expect(values).not.toContain(400_000_000);
    expect(hits.every((h) => !h.raw.toLowerCase().includes('dollár'))).toBe(true);
  });

  it('kezeli az ezres elválasztót és a ragozott alakot', () => {
    expect(parseHufAmounts('1 234 millió forintot fizetett')[0]?.ft).toBe(1_234_000_000);
    expect(parseHufAmounts('25 milliárd Ft')[0]?.ft).toBe(25_000_000_000);
    expect(parseHufAmounts('700 000 forint')[0]?.ft).toBe(700_000);
  });

  it('nem talál ki számot ott, ahol nincs', () => {
    expect(parseHufAmounts('Az ügyészség nem közölt összeget.')).toHaveLength(0);
    expect(parseHufAmounts('')).toHaveLength(0);
  });
});

describe('pickAmountNearKeywords', () => {
  it('a kulcsszóhoz legközelebbi összeget adja, nem a legnagyobbat', () => {
    const pick = pickAmountNearKeywords(F444_BODY);
    // A „kötvényfinanszírozást” szó mellett a 126 áll; a 125 az útépítés
    // költsége, a 101 a kezesség.
    expect(pick?.ft).toBe(126_000_000_000);
  });

  it('null, ha a szövegben nincs forintösszeg', () => {
    expect(pickAmountNearKeywords('Semmilyen összeget nem közöltek.')).toBeNull();
  });

  it('null, ha van összeg, de messze minden kulcsszótól', () => {
    const far = `${'lorem ipsum '.repeat(60)}42 millió forint`;
    expect(pickAmountNearKeywords(far, ['vagyoni hátrány'])).toBeNull();
  });
});

describe('lookupAmount — a valódi Duna Aszfalt-eset', () => {
  it('a forráscikk hallgat, a másodikban megvan a szám', () => {
    const r = lookupAmount([
      { url: 'https://hvg.hu/…', text: HVG_BODY },
      { url: 'https://444.hu/…', text: F444_BODY },
    ]);
    expect(r.found).toBe(true);
    if (r.found) {
      expect(r.ft).toBe(126_000_000_000);
      expect(r.url).toContain('444.hu');
    }
  });

  it('a legnagyobb kulcsszó-közeli összeg nyer, nem az első forrás', () => {
    // Ez a valódi eset tanulsága: a forrás HVG-cikk csak a KAMATOT említi,
    // a tőkét a 444-é. „Első forrás nyer" szabállyal a kamat került volna
    // be tőkeként.
    const r = lookupAmount([
      { url: 'elso', text: 'A kár 5 milliárd forint volt.' },
      { url: 'masodik', text: 'A kár 9 milliárd forint volt.' },
    ]);
    expect(r.found && r.ft).toBe(9_000_000_000);
  });

  it('ha egyik forrás sem ad számot, jelzi, mit próbált végig', () => {
    const r = lookupAmount([
      { url: 'a', text: 'Nincs benne összeg.' },
      { url: 'b', text: null },
    ]);
    expect(r.found).toBe(false);
    if (!r.found) expect(r.triedUrls).toEqual(['a', 'b']);
  });
});
