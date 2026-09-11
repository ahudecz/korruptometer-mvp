import { describe, expect, it } from 'vitest';

import { formatSlot, isQuietHour, localParts, nextPostSlot, scheduleBatch, shiftOutOfQuietHours } from './social-schedule';

/** Budapesti falióra-időpont → UTC Date. Nyári időszámításban (CEST) -2 óra. */
const cest = (iso: string) => new Date(`${iso}+02:00`);
/** Téli időszámításban (CET) -1 óra. */
const cet = (iso: string) => new Date(`${iso}+01:00`);

describe('localParts', () => {
  it('budapesti órát ad vissza, nem UTC-t', () => {
    expect(localParts(new Date('2026-09-11T12:00:00Z')).hour).toBe(14); // CEST = UTC+2
    expect(localParts(new Date('2026-01-11T12:00:00Z')).hour).toBe(13); // CET = UTC+1
  });

  it('éjfélt 0-ként adja vissza, nem 24-ként', () => {
    expect(localParts(cest('2026-09-11T00:00:00')).hour).toBe(0);
  });
});

describe('isQuietHour', () => {
  it('22:00-tól 08:00-ig csendes', () => {
    expect(isQuietHour(cest('2026-09-11T21:59:00'))).toBe(false);
    expect(isQuietHour(cest('2026-09-11T22:00:00'))).toBe(true);
    expect(isQuietHour(cest('2026-09-11T03:00:00'))).toBe(true);
    expect(isQuietHour(cest('2026-09-11T07:59:00'))).toBe(true);
    expect(isQuietHour(cest('2026-09-11T08:00:00'))).toBe(false);
  });
});

describe('shiftOutOfQuietHours', () => {
  it('a nappali időpontot érintetlenül hagyja', () => {
    const d = cest('2026-09-11T14:30:00');
    expect(shiftOutOfQuietHours(d).toISOString()).toBe(d.toISOString());
  });

  it('este 22 után másnap reggel 8-ra tolja', () => {
    expect(shiftOutOfQuietHours(cest('2026-09-11T23:30:00')).toISOString())
      .toBe(cest('2026-09-12T08:00:00').toISOString());
  });

  it('hajnalban ugyanaznap reggel 8-ra tolja', () => {
    expect(shiftOutOfQuietHours(cest('2026-09-12T02:15:00')).toISOString())
      .toBe(cest('2026-09-12T08:00:00').toISOString());
  });

  it('hónapfordulón is a következő napra lép', () => {
    expect(shiftOutOfQuietHours(cest('2026-09-30T23:00:00')).toISOString())
      .toBe(cest('2026-10-01T08:00:00').toISOString());
  });

  it('téli időszámításban is 08:00 helyi időt ad', () => {
    expect(shiftOutOfQuietHours(cet('2026-01-11T23:00:00')).toISOString())
      .toBe(cet('2026-01-12T08:00:00').toISOString());
  });
});

describe('nextPostSlot', () => {
  it('ha nincs korábbi poszt, MOST megy ki (az első azonnal)', () => {
    const now = cest('2026-09-11T10:00:00');
    expect(nextPostSlot(now, null).toISOString()).toBe(now.toISOString());
  });

  it('a korábbi poszthoz képest 3 órát vár', () => {
    const now = cest('2026-09-11T10:00:00');
    expect(nextPostSlot(now, cest('2026-09-11T09:00:00')).toISOString())
      .toBe(cest('2026-09-11T12:00:00').toISOString());
  });

  it('régi korábbi poszt nem tolja a múltba — MOST a legkorábbi', () => {
    const now = cest('2026-09-11T10:00:00');
    expect(nextPostSlot(now, cest('2026-09-09T09:00:00')).toISOString()).toBe(now.toISOString());
  });

  it('éjszakára eső slotot átdobja reggelre', () => {
    const now = cest('2026-09-11T20:00:00');
    expect(nextPostSlot(now, cest('2026-09-11T20:00:00')).toISOString())
      .toBe(cest('2026-09-12T08:00:00').toISOString());
  });

  it('éjjel jóváhagyva az "első azonnal" is reggelre csúszik', () => {
    const now = cest('2026-09-11T23:30:00');
    expect(nextPostSlot(now, null).toISOString()).toBe(cest('2026-09-12T08:00:00').toISOString());
  });
});

describe('scheduleBatch', () => {
  it('3 posztot 3 óránként oszt ki, az elsőt azonnal', () => {
    const now = cest('2026-09-11T10:00:00');
    const slots = scheduleBatch(now, null, 3);
    expect(slots.map((d) => d.toISOString())).toEqual([
      cest('2026-09-11T10:00:00').toISOString(),
      cest('2026-09-11T13:00:00').toISOString(),
      cest('2026-09-11T16:00:00').toISOString(),
    ]);
  });

  it('a napból kifutó kötegek átfordulnak másnap reggelre', () => {
    const now = cest('2026-09-11T18:00:00');
    const slots = scheduleBatch(now, null, 3);
    expect(slots.map((d) => d.toISOString())).toEqual([
      cest('2026-09-11T18:00:00').toISOString(),
      cest('2026-09-11T21:00:00').toISOString(),
      cest('2026-09-12T08:00:00').toISOString(), // 24:00 helyett
    ]);
  });

  it('a köteg a MÁR kiosztott utolsó slot után folytatódik', () => {
    const now = cest('2026-09-11T10:00:00');
    const slots = scheduleBatch(now, cest('2026-09-11T09:30:00'), 2);
    expect(slots.map((d) => d.toISOString())).toEqual([
      cest('2026-09-11T12:30:00').toISOString(),
      cest('2026-09-11T15:30:00').toISOString(),
    ]);
  });

  it('count=0 üres tömb', () => {
    expect(scheduleBatch(cest('2026-09-11T10:00:00'), null, 0)).toEqual([]);
  });
});

describe('formatSlot', () => {
  it('budapesti idő szerint formáz', () => {
    expect(formatSlot(cest('2026-09-11T14:00:00'))).toMatch(/14:00/);
  });
});
