import { describe, expect, it } from 'vitest';

import {
  gateComplaintInsert,
  gateVerdictInsert,
  hasInitialsTokens,
  isMultiPersonName,
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
