import { describe, expect, it } from 'vitest';
import * as schema from '@korr/db/schema';
import {
  computeResignationStats,
  isCountedDeparture,
  isSzerkesztosegName,
  RESIGNATION_EXCLUDED_TYPES,
  RESIGNATION_TYPE_LABEL,
  RESIGNATION_TYPE_COLOR,
  type ResignationStatRow,
} from './resignation-stats';

// A séma resignation_type enumja a forrás igazság — ha valaki hozzáad egy
// új értéket (mint a 'visszahívás' 2026-08-01-én), ez a lista automatikusan
// felveszi, teszt nélkül senki nem tudja csendben "elfelejteni" a hub-oldal
// vagy a nyitóoldal frissítését.
const ALL_TYPES = schema.resignationTypeEnum.enumValues;

describe('computeResignationStats', () => {
  it('every live resignation_type value is either excluded or lands in exactly one named bucket', () => {
    for (const type of ALL_TYPES) {
      const row: ResignationStatRow = { resignationType: type, name: 'Teszt Elek' };
      const stats = computeResignationStats([row]);

      if (RESIGNATION_EXCLUDED_TYPES.includes(type)) {
        expect(stats.osszes, `${type} should be excluded from osszes`).toBe(0);
        continue;
      }

      expect(stats.osszes, `${type} should count toward osszes`).toBe(1);
      expect(
        stats.uncategorizedCount,
        `resignationType "${type}" counts in osszes but has no dedicated stat card — ` +
          `add it to a bucket in computeResignationStats() (and a matching card in lemondasok/page.tsx)`,
      ).toBe(0);
    }
  });

  it('sums to the same total the homepage KPI counts (kirúgás/felmentés/lemondás/visszahívás all count)', () => {
    const rows: ResignationStatRow[] = [
      { resignationType: 'lemondás', name: 'A' },
      { resignationType: 'kirúgás', name: 'B' },
      { resignationType: 'felmentés', name: 'C' },
      { resignationType: 'egyéb', name: 'D' },
      { resignationType: 'visszahívás', name: 'E' },
      { resignationType: 'Hivatalban van', name: 'F' },
    ];
    const stats = computeResignationStats(rows);
    expect(stats.osszes).toBe(5); // everything except "Hivatalban van"
    expect(stats.kirugasFelmentesCount).toBe(3);
    expect(stats.lemondasCount).toBe(1);
    expect(stats.visszahivasCount).toBe(1);
    expect(stats.uncategorizedCount).toBe(0);
  });

  it('excludes szerkesztőség-named rows from every bucket regardless of type (dedupe vs. /megszunt "leépítés")', () => {
    const rows: ResignationStatRow[] = [
      { resignationType: 'kirúgás', name: 'Magyar Nemzet szerkesztősége' },
      { resignationType: 'lemondás', name: 'X Portál szerkesztősége' },
      { resignationType: 'visszahívás', name: 'Y szerkesztősége' },
    ];
    const stats = computeResignationStats(rows);
    expect(stats.osszes).toBe(0);
    expect(rows.every(r => !isCountedDeparture(r))).toBe(true);
  });

  it('isSzerkesztosegName is case-insensitive', () => {
    expect(isSzerkesztosegName('Valami SZERKESZTŐSÉGE')).toBe(true);
    expect(isSzerkesztosegName('Teszt Elek')).toBe(false);
  });
});

describe('RESIGNATION_TYPE_LABEL / RESIGNATION_TYPE_COLOR', () => {
  // 2026-08-02, user report: a nyitóoldal (resignations-section.tsx) saját,
  // harmadik szín/címke-térképet tartott karban, aminek nem volt
  // 'visszahívás' bejegyzése — szürkén jelent meg élesben, miközben a
  // /lemondasok lista már helyesen lilán mutatta. Ez a teszt biztosítja,
  // hogy minden élő resignation_type mindkét (import szerint EGYETLEN,
  // megosztott) térképben szerepeljen.
  it('every live resignation_type has both a label and a color defined', () => {
    for (const type of ALL_TYPES) {
      expect(RESIGNATION_TYPE_LABEL[type], `missing label for "${type}"`).toBeDefined();
      expect(RESIGNATION_TYPE_COLOR[type], `missing color for "${type}"`).toBeDefined();
    }
  });
});
