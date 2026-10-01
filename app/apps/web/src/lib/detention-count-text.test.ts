import { describe, expect, it } from 'vitest';

import { fillEyebrow, fillStatusItems } from './detention-count-text';
import { UGYEK } from '@app/_home/ugyek-config';

const counts = new Map([['nka-botrany', 6], ['volanbusz-ugy', 3]]);

describe('detention-count-text (2026-10-01: automatikus „X személy előzetesben”)', () => {
  it('a tokent a CourtVerdict-számra cseréli', () => {
    expect(fillEyebrow('Aktív · {elozetesben} személy előzetesben', 'nka-botrany', counts)).toBe('Aktív · 6 személy előzetesben');
  });

  it('ismeretlen szám (DB-hiba) vagy 0 esetén a szakasz kimarad, nem jelenik meg a token', () => {
    expect(fillEyebrow('Aktív · {elozetesben} személy előzetesben', 'nka-botrany', null)).toBe('Aktív');
    expect(fillEyebrow('Aktív · {elozetesben} személy előzetesben', 'aranykonvoj', counts)).toBe('Aktív');
  });

  it('státuszsoroknál a fel nem oldható sor kimarad, a többi változatlan', () => {
    const items = [
      { icon: '🔴', label: 'Letartóztatás', value: '{elozetesben} személy letartóztatva' },
      { icon: '⚖️', label: 'Eljárás', value: 'NAV' },
    ];
    expect(fillStatusItems(items, 'volanbusz-ugy', counts)?.map((i) => i.value)).toEqual(['3 személy letartóztatva', 'NAV']);
    expect(fillStatusItems(items, 'volanbusz-ugy', null)?.map((i) => i.value)).toEqual(['NAV']);
  });

  it('a config NKA- és Volánbusz-eyebrowja már a tokent használja, nem kézi számot', () => {
    for (const id of ['nka-botrany', 'volanbusz-ugy']) {
      expect(UGYEK.find((u) => u.id === id)?.eyebrow).toContain('{elozetesben}');
    }
  });
});
