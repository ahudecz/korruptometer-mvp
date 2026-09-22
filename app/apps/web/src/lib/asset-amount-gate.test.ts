import { describe, expect, it, vi } from 'vitest';

// A modul importlánca (asset-amount-gate → … → digest-send) 'server-only'-t
// húz be, amit a vitest nem tud feloldani — enélkül az egész fájl elszáll.
vi.mock('server-only', () => ({}));

import { AMOUNT_CALLBACK_PREFIX, parseAmountReply } from './asset-amount-gate';

/**
 * A gombok és a válasz-ág SZERZŐDÉSE.
 *
 * Miért külön teszt: ebben a projektben már ment ki élesbe olyan
 * Telegram-billentyűzet, amelynek EGYETLEN gombja sem csinált semmit
 * ([[project-telegram-buttons-sensitive-env]]) — a hiba csak méréssel jött
 * elő, kódolvasással nem. Ez a teszt azt rögzíti, amit a webhook-ág vár:
 * a callback-adat alakját és azt, hogy a begépelt összeg értelmezhető.
 */
describe('összeg-kapu: callback-adat', () => {
  it('a prefix rövid, elfér a Telegram 64 bájtos korlátjában', () => {
    const uuid = '59ea341f-c93e-4c4c-ab8b-2259047e21bb';
    for (const code of ['w', 'n', 'x']) {
      const data = `${AMOUNT_CALLBACK_PREFIX}:${code}:${uuid}`;
      expect(Buffer.byteLength(data, 'utf8')).toBeLessThanOrEqual(64);
      // A webhook `cq.data.split(':')` alapján bont — pontosan három rész.
      expect(data.split(':')).toHaveLength(3);
    }
  });
});

describe('parseAmountReply — amit a szerkesztő begépel', () => {
  it('mértékegységgel', () => {
    expect(parseAmountReply('126 milliárd')).toBe(126_000_000_000);
    expect(parseAmountReply('126 milliárd forint')).toBe(126_000_000_000);
    expect(parseAmountReply('25 millió Ft')).toBe(25_000_000);
    expect(parseAmountReply('700 ezer')).toBe(700_000);
  });

  it('puszta számmal, ezres elválasztóval is', () => {
    expect(parseAmountReply('126000000000')).toBe(126_000_000_000);
    expect(parseAmountReply('126 000 000 000')).toBe(126_000_000_000);
  });

  it('tizedessel', () => {
    expect(parseAmountReply('1,5 milliárd')).toBe(1_500_000_000);
  });

  it('null, ha nem összeg — ilyenkor a bot visszakérdez, nem talál ki számot', () => {
    expect(parseAmountReply('nem tudom')).toBeNull();
    expect(parseAmountReply('')).toBeNull();
    expect(parseAmountReply('0')).toBeNull();
  });
});
