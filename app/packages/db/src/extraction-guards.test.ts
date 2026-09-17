import { describe, expect, it } from 'vitest';

import {
  evidenceQuoteSupported,
  findMisinflectedName,
  hasEvidenceQuote,
  isRelationalOnlyMention,
  looksLikePersonName,
  mentionsUnknownPerpetrator,
  namedTargetContradictsUnknownPerpetrator,
} from './extraction-guards';
import { isPlaceholderName } from './detection-check';

// A 2026-09-08-i Fásy/NKA-eset forrásszövegének szerkezete: a cikk a
// FELESÉGRŐL szól, Fásy Ádám csak viszonyszóval szerepel benne.
const FASY_ARTICLE = [
  'Letartóztatták Fásy Ádám feleségét az NKA-ügyben',
  'A Kecskeméti Járásbíróság egy hónapra letartóztatta Fásyné Gurzó Máriát,',
  'Fásy Ádám feleségét, valamint Szabó Sándort, a Munkácsy Art Kft. tulajdonosát.',
].join('\n');

describe('evidenceQuoteSupported (folyamatjavaslat 1. — bizonyíték-idézet)', () => {
  it('átengedi a cikkben ténylegesen szereplő mondatot', () => {
    expect(
      evidenceQuoteSupported('A Kecskeméti Járásbíróság egy hónapra letartóztatta Fásyné Gurzó Máriát', FASY_ARTICLE),
    ).toBe(true);
  });

  it('átengedi a kicsit átfogalmazott idézetet is (nem szó szerinti hűséget mérünk)', () => {
    expect(
      evidenceQuoteSupported('A Kecskeméti Járásbíróság letartóztatta Fásyné Gurzó Máriát az ügyben', FASY_ARTICLE),
    ).toBe(true);
  });

  // EZ a lényeg: a teljesen kitalált mondat elbukik, tehát a sor emberi
  // jóváhagyásra megy ahelyett, hogy automatikusan kimenne.
  it('elbuktatja a cikkben sehol nem szereplő idézetet', () => {
    expect(
      evidenceQuoteSupported('A bíróság augusztus 26-án jogerősen elítélte Fásy Ádámot csalás miatt', FASY_ARTICLE),
    ).toBe(false);
  });

  it('a hiányzó/túl rövid idézet nem buktat (fukar modell-válasz ne küldjön mindent jóváhagyásra)', () => {
    expect(evidenceQuoteSupported('', FASY_ARTICLE)).toBe(true);
    expect(evidenceQuoteSupported(null, FASY_ARTICLE)).toBe(true);
    expect(hasEvidenceQuote('')).toBe(false);
    expect(hasEvidenceQuote('A Kecskeméti Járásbíróság döntött.')).toBe(true);
  });
});

describe('isRelationalOnlyMention (folyamatjavaslat 2. — viszonyszó-őr)', () => {
  // A valódi incidens: a sor "Fásy Ádám" néven futott, holott a cikkben a
  // neve KIZÁRÓLAG "Fásy Ádám felesége" szerkezetben szerepel.
  it('elkapja a csak viszonyszóval említett nevet', () => {
    expect(isRelationalOnlyMention('Fásy Ádám', FASY_ARTICLE)).toBe(true);
  });

  it('NEM kapja el azt, akiről a cikk tényleg szól', () => {
    expect(isRelationalOnlyMention('Fásyné Gurzó Mária', FASY_ARTICLE)).toBe(false);
    expect(isRelationalOnlyMention('Szabó Sándor', FASY_ARTICLE)).toBe(false);
  });

  it('egyetlen önálló említés is elég ahhoz, hogy ne jelezzen', () => {
    const text = 'Tiborcz István üzlettársát vitték el. Tiborcz Istvánt nem gyanúsítják.';
    expect(isRelationalOnlyMention('Tiborcz István', text)).toBe(false);
  });

  it('a cikkben egyáltalán nem szereplő névre nem jelez', () => {
    expect(isRelationalOnlyMention('Orbán Viktor', FASY_ARTICLE)).toBe(false);
  });

  it('a munkatárs/kabinetfőnök szerkezetet is elkapja', () => {
    const text = 'Őrizetbe vették Hankó Balázs egykori kabinetfőnökét az NKA-ügyben.';
    expect(isRelationalOnlyMention('Hankó Balázs', text)).toBe(true);
  });
});

describe('„ismeretlen tettes" szabály (folyamatjavaslat 3.)', () => {
  const UNKNOWN_ARTICLE =
    'A minisztérium feljelentést tett ismeretlen tettes ellen a Volánbusz-beszerzések ügyében. '
    + 'A cikk szerint Szivek Norbert vezette akkor a céget.';

  it('felismeri az ismeretlen tettes elleni feljelentést', () => {
    expect(mentionsUnknownPerpetrator(UNKNOWN_ARTICLE)).toBe(true);
    expect(mentionsUnknownPerpetrator('Feljelentést tettek ismeretlen elkövető ellen.')).toBe(true);
    expect(mentionsUnknownPerpetrator('A Kúria jogerős ítéletet hozott.')).toBe(false);
  });

  // A ráfogás: a cikk ismeretlen tettesről ír, a modell mégis a szövegben
  // szereplő vezetőt teszi be célpontnak.
  it('jóváhagyásra küldi, ha ilyenkor mégis SZEMÉLYT nevesít a célpont', () => {
    expect(namedTargetContradictsUnknownPerpetrator('Szivek Norbert', UNKNOWN_ARTICLE)).toBe(true);
  });

  it('az ÜGY-címke viszont teljesen jogos célpont ilyenkor', () => {
    expect(namedTargetContradictsUnknownPerpetrator('Volánbusz-ügy', UNKNOWN_ARTICLE)).toBe(false);
    expect(namedTargetContradictsUnknownPerpetrator('NKA-botrány', UNKNOWN_ARTICLE)).toBe(false);
    expect(namedTargetContradictsUnknownPerpetrator('Magyar Nemzeti Bank', UNKNOWN_ARTICLE)).toBe(false);
  });

  it('nevesített tettesnél nem szól bele', () => {
    expect(namedTargetContradictsUnknownPerpetrator('Szivek Norbert', 'Feljelentést tettek Szivek Norbert ellen.')).toBe(false);
  });

  it('looksLikePersonName konzervatív: ami bizonytalan, az nem személynév', () => {
    expect(looksLikePersonName('Szivek Norbert')).toBe(true);
    expect(looksLikePersonName('Krucsainé Herter Anikó')).toBe(true);
    expect(looksLikePersonName('Volánbusz Zrt.')).toBe(false);
    expect(looksLikePersonName('Igazságügyi Minisztérium')).toBe(false);
    expect(looksLikePersonName('Pilz')).toBe(false); // egytagú
    expect(looksLikePersonName('')).toBe(false);
  });
});

describe('isPlaceholderName — másodlagos mezőkre is (leltár-tétel)', () => {
  // A ténylegesen élesre ment érték: CriminalComplaint 85f00a63 filerName-je.
  it('elkapja a <UNKNOWN> bejelentőt', () => {
    expect(isPlaceholderName('<UNKNOWN>')).toBe(true);
  });

  it('elkapja a bővített placeholder-alakokat', () => {
    for (const v of [
      '', '   ', '-', '--', '?', 'n/a', 'N.A.', 'null', 'undefined', 'none',
      'ismeretlen', 'Ismeretlen', '(ismeretlen)', '[unknown]', 'nincs adat',
      'nem ismert', 'TBD', 'ismeretlen tettes', 'ismeretlen elkövető',
    ]) {
      expect(isPlaceholderName(v), `"${v}" placeholder kellene legyen`).toBe(true);
    }
  });

  it('a valódi neveket és intézményeket békén hagyja', () => {
    for (const v of [
      'Hadházy Ákos', 'Transparency International', 'Miniszterelnökség',
      'Pilz Tamás', 'a kormány', 'Integritás Hatóság',
    ]) {
      expect(isPlaceholderName(v), `"${v}" NEM lehet placeholder`).toBe(false);
    }
  });
});

describe('findMisinflectedName (2026-09-17, „Szivek Norberta")', () => {
  // A valódi forráscikk mondatai. A név végig TÁRGYESETBEN szerepel, ezért
  // kellett a modellnek visszafejtenie — és ezért tudott elrontani.
  const CIKK =
    'A Központi Nyomozó Főügyészség kihallgatásra idézte Szivek Norbertet és ' +
    'Jellinek Dánielt az öt éve húzódó Volánbusz-ügyben. Az ügyészség ' +
    'előállította Jellinek Dánielt, Tiborcz István üzlettársát, valamint Szivek Norbertet.';

  it('elkapja a rosszul visszafejtett ragot, és megmondja a helyes alakot', () => {
    expect(findMisinflectedName('Szivek Norberta', CIKK)).toEqual({
      extracted: 'Szivek Norberta',
      inArticle: 'Szivek Norbertet',
      suggested: 'Szivek Norbert',
    });
  });

  it('a HELYESEN visszafejtett nevet békén hagyja', () => {
    expect(findMisinflectedName('Szivek Norbert', CIKK)).toBeNull();
    expect(findMisinflectedName('Jellinek Dániel', CIKK)).toBeNull();
  });

  it('hallgat, ha a név egyáltalán nem szerepel a szövegben', () => {
    // A kivonat rövidebb lehet a cikknél — egy „nincs benne" jelzés
    // tömegesen, hamisan riasztana, ezért ez az őr szándékosan szűk.
    expect(findMisinflectedName('Teljesen Más Ember', CIKK)).toBeNull();
  });

  it('nem jelez rövid keresztnévre vagy egyszavas névre', () => {
    expect(findMisinflectedName('Szivek', CIKK)).toBeNull();
    expect(findMisinflectedName('Nagy Ede', 'Nagy Edét idézték be')).toBeNull();
  });
});
