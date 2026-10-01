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

describe('Hatvanpuszta-ügyoldal (2026-10-01: bővített, forrásolt tartalom)', () => {
  const hp = UGYEK.find((u) => u.id === 'hatvanpuszta')!;
  const blocks = hp.descriptionBlocks ?? [];

  it('a tervek helyiséglistája ikonos „szolgáltatások” rács, a meg nem épült elemek jelölve', () => {
    const fac = blocks.find((b) => b.type === 'facilities');
    expect(fac && fac.type === 'facilities' && fac.items.length).toBeGreaterThanOrEqual(12);
    expect(fac && fac.type === 'facilities' && fac.items.filter((i) => i.planned).map((i) => i.label)).toEqual(
      expect.arrayContaining(['Kápolna', 'Két orangerie']),
    );
  });

  it('van kiemelt idézet, kép és szakaszonkénti keretes forrás', () => {
    expect(blocks.some((b) => b.type === 'quote')).toBe(true);
    expect(blocks.some((b) => b.type === 'image')).toBe(true);
    expect(blocks.filter((b) => b.type === 'article-card').length).toBeGreaterThanOrEqual(10);
  });

  it('egy videó sem szerepel kétszer (blokk és „Kapcsolódó videók”), és nincs követőkódos link', () => {
    const inBlocks = blocks.flatMap((b) => (b.type === 'video' ? [b.id] : []));
    const extra = (hp.additionalVideos ?? []).map((v) => v.id);
    expect(inBlocks.filter((id) => extra.includes(id) || id === hp.videoId)).toEqual([]);
    expect(JSON.stringify(hp)).not.toContain('utm_source');
  });

  it('az idővonal rendes idővonal-blokk (nem egy bekezdésbe sűrített szöveg)', () => {
    const tl = blocks.find((b) => b.type === 'timeline');
    expect(tl && tl.type === 'timeline' && tl.items.length).toBeGreaterThanOrEqual(8);
    expect(blocks.some((b) => b.type === 'text' && b.content.startsWith('2011:'))).toBe(false);
  });

  it('a hibás „Vas megye” helyszín eltűnt', () => {
    expect(JSON.stringify(hp)).not.toContain('Vas megye');
  });
});

describe('NKA-ügyoldal: júliusi állapot óta eltelt frissítés (2026-10-01)', () => {
  const blocks = UGYEK.find((u) => u.id === 'nka-botrany')?.descriptionBlocks ?? [];
  const texts = blocks.flatMap((b) => (b.type === 'text' ? [b.content] : [])).join(' ');

  it('a lap végén van frissítés Fásynéról, a visszautalásokról és Hankó távozásáról, idővonallal', () => {
    expect(texts).toContain('Fásyné Gurzó Máriát');
    expect(texts).toContain('4 milliárd forintra');
    expect(texts).toContain('a sofőr azonban tévedésből elhajtott');
    expect(blocks.at(-1)?.type).toBe('timeline');
  });

  it('a breaking-csoportok sorrendje nem változott: az első breaking-group a tömb elején marad', () => {
    expect(blocks.findIndex((b) => b.type === 'breaking-group')).toBe(0);
  });
});

