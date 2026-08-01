import { describe, expect, it } from 'vitest';
import * as schema from '@korr/db/schema';
import { computeMediaClosureStats, type MediaClosureStatRow } from './media-closure-stats';

// A séma media_closure_type enumja a forrás igazság — 2026-08-02, user
// report: a "Teljes megszűnés" + "Leépítés" kártyák összege korábban NEM
// egyezett a táblázatban ténylegesen kilistázott sorok számával, mert az
// összesítő csak ezt a két típust számolta, a 'elmaradt esemény' és 'egyéb'
// típusú (élesben már létező!) sorokat lehagyta.
const ALL_TYPES = schema.mediaClosureTypeEnum.enumValues;

describe('computeMediaClosureStats', () => {
  it('mediaCount always equals the row count, regardless of eventType — matches both the table and the homepage KPI', () => {
    for (const type of ALL_TYPES) {
      const rows: MediaClosureStatRow[] = [{ eventType: type }];
      expect(computeMediaClosureStats(rows).mediaCount, `eventType "${type}" must count toward mediaCount`).toBe(1);
    }
  });

  it('the two highlighted cards never exceed the total, and unaccounted types are surfaced (not silently dropped)', () => {
    const rows: MediaClosureStatRow[] = ALL_TYPES.map(eventType => ({ eventType }));
    const stats = computeMediaClosureStats(rows);
    expect(stats.mediaCount).toBe(ALL_TYPES.length);
    expect(stats.megszuntCount + stats.leepitesCount + stats.uncategorizedCount).toBe(stats.mediaCount);
  });

  it('mixed real-world distribution sums correctly (regression fixture: prod once showed 19 instead of 21)', () => {
    const rows: MediaClosureStatRow[] = [
      ...Array(14).fill({ eventType: 'megszűnés' }),
      ...Array(5).fill({ eventType: 'leépítés' }),
      { eventType: 'elmaradt esemény' },
      { eventType: 'egyéb' },
    ];
    const stats = computeMediaClosureStats(rows);
    expect(stats.megszuntCount).toBe(14);
    expect(stats.leepitesCount).toBe(5);
    expect(stats.mediaCount).toBe(21);
  });
});
