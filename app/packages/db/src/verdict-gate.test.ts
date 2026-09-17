import { describe, expect, it } from 'vitest';

import {
  splitPersonNames,
  coercePretrialClaim,
  CUSTODY_MAX_HOURS,
  isCustodyExpired,
  selectExpiredCustodyRows,
  gateComplaintInsert,
  gateVerdictInsert,
  hasDetentionSignal,
  hasInitialsTokens,
  isCustodyOnly,
  isMultiPersonName,
  type CustodyRow,
} from './verdict-gate';

// A 2026-09-15-i incidens két VALÓDI sora — ezek mentek ki élesre, miközben
// mindkét ember már szerepelt a saját, nevesített sorával. Ezek a stringek
// szándékosan szó szerint szerepelnek, hogy ha a szabályok valaha
// visszacsúsznak, pont ez az eset bukjon el.
const COLLECTIVE = 'Jellinek Dániel, Szivek Norbert';
const INITIALS = 'Tiborcz István üzlettársa / J. D. és Sz. N.';

describe('hasInitialsTokens', () => {
  it('elkapja a monogramos gyűjtőnevet', () => {
    expect(hasInitialsTokens(INITIALS)).toBe(true);
  });
  it('nem kapja el a valódi neveket', () => {
    for (const n of ['Jellinek Dániel', 'Szivek Norbert', 'Bús Balázs', 'Krucsainé Herter Anikó']) {
      expect(hasInitialsTokens(n)).toBe(false);
    }
  });
  it('egyetlen középső monogramot még megenged', () => {
    expect(hasInitialsTokens('Nagy J. Péter')).toBe(false);
  });
  // A rövidített cím alakilag monogram — enélkül "Dr." + "P." két
  // monogramnak számítana, és egy valódi név veszne el.
  it('a rövidített címet nem számolja monogramnak', () => {
    expect(hasInitialsTokens('Dr. Kovács P. Béla')).toBe(false);
    expect(hasInitialsTokens('Ifj. Nagy K. Zoltán')).toBe(false);
  });
});

describe('isMultiPersonName', () => {
  it('elkapja a vesszővel összefűzött két nevet', () => {
    expect(isMultiPersonName(COLLECTIVE)).toBe(true);
  });
  it('elkapja az "és"-sel összefűzött két nevet', () => {
    expect(isMultiPersonName('Szabó Sándor és Fásyné Gurzó Mária')).toBe(true);
  });
  it('elkapja a "/" elválasztót', () => {
    expect(isMultiPersonName(INITIALS)).toBe(true);
  });
  it('NEM kapja el a név + pozíció alakot', () => {
    expect(isMultiPersonName('Szivek Norbert, az MNV volt vezérigazgatója')).toBe(false);
  });
  it('NEM kapja el az egyszerű neveket', () => {
    for (const n of ['Jellinek Dániel', 'Hankó Balázs kabinetfőnöke', 'Ismeretlen nevű ötvenéves férfi']) {
      expect(isMultiPersonName(n)).toBe(false);
    }
  });
});

describe('gateVerdictInsert', () => {
  const emptyDb = { execute: async () => [] };

  it('a monogramos gyűjtőnevet eldobja, DB-hívás nélkül', async () => {
    let queried = false;
    const db = { execute: async () => { queried = true; return []; } };
    const r = await gateVerdictInsert(db, { personName: INITIALS, sourceUrl: 'https://x.hu/a' });
    expect(r.verdict).toBe('discard');
    expect(r.reason).toBe('initials_name');
    expect(queried).toBe(false);
  });

  it('a két nevet összefűző sort jóváhagyásra küldi (nem dobja el)', async () => {
    const r = await gateVerdictInsert(emptyDb, { personName: COLLECTIVE, sourceUrl: 'https://x.hu/a' });
    expect(r.verdict).toBe('flag');
    expect(r.reason).toBe('multi_person_name');
  });

  /**
   * 2026-09-17, user report — a valódi eset, ami kiment élesre.
   *
   * A „Jellinek Dániel, Szivek Norberta, és további gyanúsítottak" sor
   * jóváhagyásra ment (eddig jó), DE a kapu a gyűjtőnév-ágon azonnal
   * visszatért, így meg sem nézte, hogy mindkét ember külön, már jóváhagyott
   * sorral szerepel a táblában. A jóváhagyó ezért egy információ nélküli
   * kérdést kapott, és — a cikkben szereplő három új gyanúsított miatt,
   * helyesen — igent mondott. A duplikátum így ment ki.
   *
   * A rögzített elvárás: a gyűjtőnév MELLETT is le kell futnia a
   * duplikátum-keresésnek, és minden ütközést vissza kell adnia.
   */
  it('gyűjtőnévnél is megtalálja az ÖSSZES már meglévő sort', async () => {
    const existing = [
      { id: 'jellinek-row', personName: 'Jellinek Dániel' },
      { id: 'szivek-row', personName: 'Szivek Norbert' },
    ];
    let call = 0;
    const db = {
      execute: async () => {
        call += 1;
        // 1. hívás: forrás-URL (új cikk, nincs találat).
        // 2.: teljes gyűjtőnév — a LIKE mindkettőt eltalálja.
        // 3–4.: a darabok külön-külön.
        if (call === 1) return [];
        return existing;
      },
    };
    const r = await gateVerdictInsert(db, {
      personName: 'Jellinek Dániel, Szivek Norberta, és további gyanúsítottak',
      sourceUrl: 'https://444.hu/2026/09/17/ujabb-gyanusitottja-van-a-volanbusz-korrupcios-ugyenek',
    });
    expect(r.verdict).toBe('flag');
    expect(r.reason).toBe('multi_person_name');
    expect(r.conflicts?.map((c) => c.id).sort()).toEqual(['jellinek-row', 'szivek-row']);
    // A régi, egyelemű mező is kitöltve marad a meglévő hívók kedvéért.
    expect(r.conflictsWith).not.toBeNull();
  });

  it('az elgépelt nevű darabot is megtalálja, mert darabonként is keres', async () => {
    // „Szivek Norberta" (elgépelve) — a teljes sztringre futó illesztés a
    // meglévő „Szivek Norbert" sort így is eltalálja, de a darabonkénti
    // keresés az, ami ezt garantálja, nem a véletlen.
    expect(splitPersonNames('Jellinek Dániel, Szivek Norberta, és további gyanúsítottak')).toEqual([
      'Jellinek Dániel',
      'Szivek Norberta',
    ]);
  });

  // Ez a jel önmagában megfogta volna a 2026-09-15-i esetet: a duplikátum
  // sor forrás-URL-je bitre azonos volt a már meglévő sorokéval.
  it('jelzi, ha ugyanabból a cikkből már született sor', async () => {
    const db = { execute: async () => [{ id: 'abc', personName: 'Jellinek Dániel' }] };
    const r = await gateVerdictInsert(db, {
      personName: 'Valaki Más',
      sourceUrl: 'https://hvg.hu/itthon/20260915_orizetbe-vetel-ugyeszseg-volanbusz-korrupcio',
    });
    expect(r.verdict).toBe('flag');
    expect(r.reason).toBe('source_url_reused');
    expect(r.conflictsWith).toEqual({ id: 'abc', personName: 'Jellinek Dániel' });
  });

  it('jelzi a töredék-név egyezést', async () => {
    let calls = 0;
    const db = {
      execute: async () => {
        calls += 1;
        // 1. hívás: forrás-URL keresés (nincs találat), 2.: töredék-név
        return calls === 1 ? [] : [{ id: 'def', personName: 'Szivek Norbert' }];
      },
    };
    const r = await gateVerdictInsert(db, { personName: 'Szivek Norbert', sourceUrl: 'https://uj.hu/cikk' });
    expect(r.verdict).toBe('flag');
    expect(r.reason).toBe('fragment_name_match');
    expect(r.conflictsWith?.personName).toBe('Szivek Norbert');
  });

  it('tiszta esetben átengedi', async () => {
    const r = await gateVerdictInsert(emptyDb, { personName: 'Teljesen Új Ember', sourceUrl: 'https://uj.hu/cikk' });
    expect(r.verdict).toBe('ok');
    expect(r.reason).toBeUndefined();
  });

  it('forrás-URL nélkül is lefut (csak a név-ágakat nézi)', async () => {
    const r = await gateVerdictInsert(emptyDb, { personName: 'Teljesen Új Ember', sourceUrl: null });
    expect(r.verdict).toBe('ok');
  });
});

describe('gateComplaintInsert (CriminalComplaint)', () => {
  const emptyDb = { execute: async () => [] };

  it('a monogramos gyűjtőnevet ott is eldobja', async () => {
    const r = await gateComplaintInsert(emptyDb, { personName: INITIALS, sourceUrl: 'https://x.hu/a' });
    expect(r.verdict).toBe('discard');
  });

  it('jelzi, ha ugyanabból a cikkből már született feljelentés-sor', async () => {
    const db = { execute: async () => [{ id: 'c1', personName: 'Volánbusz-ügy' }] };
    const r = await gateComplaintInsert(db, { personName: 'Másik ügy', sourceUrl: 'https://x.hu/a' });
    expect(r.verdict).toBe('flag');
    expect(r.reason).toBe('source_url_reused');
  });

  // A feljelentés-címkék szándékosan ismétlődnek ('NKA-botrány' több soron
  // is), ezért a töredék-név egyezés ITT nincs bekapcsolva — különben
  // tömegesen, hamisan küldene mindent jóváhagyásra.
  it('NEM jelez töredék-név egyezésre', async () => {
    let calls = 0;
    const db = { execute: async () => { calls += 1; return []; } };
    const r = await gateComplaintInsert(db, { personName: 'NKA-botrány', sourceUrl: 'https://uj.hu/c' });
    expect(r.verdict).toBe('ok');
    expect(calls).toBe(1); // csak a forrás-URL lekérdezés futott
  });
});

// ---------------------------------------------------------------------------
// 2026-09-16, user report: "Pilz Tamás nincs előzetesben, ha valakit
// kihallgatnak, attól még nem kerül előzetesbe."
// ---------------------------------------------------------------------------

/** A 7c275b15 sor VALÓDI mezői, ahogy élesre mentek. */
const PILZ = {
  sentenceLabel: 'kihallgatás',
  summary:
    'Pilz Tamást, Tuzson Bence volt államtitkári munkatársát személyes adattal való visszaéléssel gyanúsítják, mivel állítólag jóváhagyta olyan közalkalmazottak kirúgását, akik letöltötték a Tisza Világ applikációt.',
  headline: 'RTL: Kihallgatták Tuzson Bence volt államtitkárát a Tisza-szimpatizánsok kirúgása miatt',
};

/** A 2026-09-15-i Volánbusz-sorok: őrizet igen, letartóztatás még nem. */
const SZIVEK = {
  sentenceLabel: 'őrizetbe véve',
  summary:
    'Szivek Norbertet, a Magyar Nemzeti Vagyonkezelő egykori vezérigazgatóját 2026. szeptember 10-én gyanúsítottként hallgatták ki a Volán-buszok túlárazása ügyében. Szeptember 15-én a Központi Nyomozó Főügyészség a négy gyanúsított közül hármat őrizetbe vett; a letartóztatásról bíróság dönt.',
  headline: 'Három embert őrizetbe vett az ügyészség a túlárazott Volán-buszok ügyében',
};

describe('hasDetentionSignal', () => {
  it('a puszta kihallgatás/gyanúsítás NEM fogvatartás', () => {
    expect(hasDetentionSignal(PILZ.sentenceLabel, PILZ.summary, PILZ.headline)).toBe(false);
  });
  it('az őrizetbe vétel fogvatartás (2026-09-16 user döntés)', () => {
    expect(hasDetentionSignal(SZIVEK.sentenceLabel, SZIVEK.summary, SZIVEK.headline)).toBe(true);
  });
  it('a letartóztatás fogvatartás, ragozott alakban is', () => {
    expect(hasDetentionSignal(null, 'A Fővárosi Törvényszék letartóztatta a polgármestert.')).toBe(true);
    expect(hasDetentionSignal('előzetes letartóztatás meghosszabbítva')).toBe(true);
    expect(hasDetentionSignal(null, '2026. június 4-én vette előzetes letartóztatásba a bíróság.')).toBe(true);
  });
  it('üres bemenetre nem állít fogvatartást', () => {
    expect(hasDetentionSignal(null, undefined, '')).toBe(false);
  });
});

describe('coercePretrialClaim', () => {
  // EZ a rögzítő teszt: ha valaha visszacsúszik, pont a Pilz-sor bukjon el.
  it("a kihallgatás-only sort 'egyéb'-re minősíti vissza", () => {
    expect(coercePretrialClaim('előzetesben', PILZ)).toBe('egyéb');
  });
  it('a valódi fogvatartást békén hagyja', () => {
    expect(coercePretrialClaim('előzetesben', SZIVEK)).toBe('előzetesben');
    expect(coercePretrialClaim('előzetesben', { sentenceLabel: 'előzetes letartóztatás' })).toBe('előzetesben');
  });
  it('minden más típust változatlanul enged át (a kapu sosem emel)', () => {
    for (const t of ['jogerős', 'elsőfokú', 'vádemelés', 'szabadlábra helyezve', 'eljárás megszűnt', 'felmentve', 'egyéb']) {
      expect(coercePretrialClaim(t, PILZ)).toBe(t);
    }
  });
});

describe('isCustodyOnly', () => {
  it('a Volánbusz-sorokat őrizet-onlynak látja (a "letartóztatásról bíróság dönt" ellenére)', () => {
    expect(isCustodyOnly(SZIVEK.sentenceLabel, SZIVEK.summary, SZIVEK.headline)).toBe(true);
  });
  it('a kezdeményezett letartóztatás még őrizet', () => {
    expect(isCustodyOnly('őrizetbe vétel, letartóztatást kezdeményeztek')).toBe(true);
  });
  it('az elrendelt letartóztatás NEM őrizet-only', () => {
    expect(isCustodyOnly('őrizetbe vétel', 'A bíróság egy hónapra letartóztatta.')).toBe(false);
  });
  it('őrizet-említés nélkül nem jelez', () => {
    expect(isCustodyOnly('előzetes letartóztatás', 'Meghosszabbították a letartóztatását.')).toBe(false);
    expect(isCustodyOnly(PILZ.sentenceLabel, PILZ.summary)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2026-09-16, user kérés: "figyelje a híreket, ha kiengednek olyat aki csak
// őrizetben van, akkor frissüljön az adat." A 72 órás őrizet lejárta naptár
// kérdése, nem híré — l. check-custody-expiry.ts.
// ---------------------------------------------------------------------------

const NOW = new Date('2026-09-20T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const custodyRow = (verdictDate: Date): CustodyRow => ({
  id: 'row-1',
  personName: 'Szivek Norbert',
  sentenceLabel: SZIVEK.sentenceLabel,
  summary: SZIVEK.summary,
  verdictDate,
  sourceUrls: ['https://hvg.hu/itthon/20260915_orizetbe-vetel-ugyeszseg-volanbusz-korrupcio'],
});

/** Elrendelt letartóztatás — hónapokig tart, sosem jár le magától. */
const arrestRow: CustodyRow = {
  id: 'row-2',
  personName: 'Bús Balázs',
  sentenceLabel: 'előzetes letartóztatás meghosszabbítva (3 hónap)',
  summary: 'A Kecskeméti Járásbíróság három hónappal meghosszabbította a letartóztatását.',
  verdictDate: hoursAgo(24 * 60),
  sourceUrls: ['https://example.hu/a'],
};

describe('isCustodyExpired', () => {
  it('a 72 órán belüli őrizet még friss', () => {
    expect(isCustodyExpired(hoursAgo(CUSTODY_MAX_HOURS - 1), NOW)).toBe(false);
  });
  it('a 72 óra letelte után, de a ráhagyáson belül még nem riaszt', () => {
    expect(isCustodyExpired(hoursAgo(CUSTODY_MAX_HOURS + 12), NOW)).toBe(false);
  });
  it('a ráhagyás után lejártnak számít', () => {
    expect(isCustodyExpired(hoursAgo(CUSTODY_MAX_HOURS + 30), NOW)).toBe(true);
  });
  it('értelmezhetetlen dátumra nem riaszt', () => {
    expect(isCustodyExpired('nem-dátum', NOW)).toBe(false);
  });
});

describe('selectExpiredCustodyRows', () => {
  it('kiválasztja a lejárt őrizetet', () => {
    expect(selectExpiredCustodyRows([custodyRow(hoursAgo(120))], NOW).map((r) => r.id)).toEqual(['row-1']);
  });
  it('az elrendelt letartóztatást SOSEM választja ki, akármilyen régi', () => {
    expect(selectExpiredCustodyRows([arrestRow], NOW)).toEqual([]);
  });
  it('a friss őrizetet még nem választja ki', () => {
    expect(selectExpiredCustodyRows([custodyRow(hoursAgo(10))], NOW)).toEqual([]);
  });
});
