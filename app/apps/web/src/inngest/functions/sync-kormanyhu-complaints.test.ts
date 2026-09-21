import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: vi.fn(async () => undefined) }));

const officialItems = [
  {
    name: 'M6 koncesszió',
    ministry: 'Közlekedési és Beruházási Minisztérium',
    description:
      'Az építési és közlekedési miniszter a hatáskörét túllépve részesített előnyben magasabb összegű ajánlatot adó vállalkozót.',
    amountLabel: '100 milliárd Ft',
    filedDateIso: '2026-08-14',
    status: 'nincs adat a nyomozó szerv eljárásáról',
    sourceUrl: 'https://kormany.hu/atlathato/feljelentes',
  },
];

vi.mock('@korr/scrapers/kormanyhu-feljelentes', () => ({
  fetchKormanyHuComplaints: vi.fn(async () => officialItems),
}));

const updates: Array<Record<string, unknown>> = [];
const inserts: Array<Record<string, unknown>> = [];

// A sajtócikkből kinyert saját sorunk, ahogy 2026-09-21-ig élesben állt:
// saját cím, saját megfogalmazás, a cikk dátumával.
const ourRow = {
  id: 'row-1',
  targetName: 'Lázár János autópálya-koncesszió szerződés — Mészáros/Szíjj érdekkörhöz',
  filerName: 'Közlekedési és Beruházási Minisztérium (Vitézy Dávid)',
  description: 'Vitézy Dávid feljelentést tett Lázár János ellen hűtlen kezelés és hivatali visszaélés gyanúja miatt az M6 koncesszió ügyében.',
  amountLabel: '100 milliárd Ft',
  status: 'investigating',
  eventDate: new Date('2026-09-21'),
  sourceUrls: ['https://444.hu/2026/09/21/hutlen-kezeles'],
  sourceNames: ['444.hu'],
  sourceHeadlines: ['Feljelentés az M6-os ügyében'],
  sourceDates: ['2026-09-21'],
};

vi.mock('@/lib/db', () => ({
  schema: { criminalComplaints: { id: 'id' } },
  getDb: () => ({
    select: () => ({ from: () => [ourRow] }),
    update: () => ({ set: (patch: Record<string, unknown>) => ({ where: () => { updates.push(patch); } }) }),
    insert: () => ({ values: (row: Record<string, unknown>) => { inserts.push(row); } }),
  }),
}));

import { runKormanyHuSyncCore } from './sync-kormanyhu-complaints';

const step = { run: (async (_n: string, fn: () => unknown) => fn()) as never, sendEvent: (async () => null) as never };

describe('sync-kormanyhu: a hivatalos szöveg felülírja a sajtóból kinyertet', () => {
  it('a matchelt kormányzati sorra átmásolja a címet, a leírást és a dátumot', async () => {
    const result = await runKormanyHuSyncCore({ step });

    expect(inserts).toHaveLength(0);
    expect(result.updated).toBe(1);
    expect(updates).toHaveLength(1);

    const patch = updates[0]!;
    expect(patch.targetName).toBe('M6 koncesszió');
    expect(patch.description).toBe(officialItems[0]!.description);
    expect((patch.eventDate as Date).toISOString().slice(0, 10)).toBe('2026-08-14');
    expect((patch.filedAt as Date).toISOString().slice(0, 10)).toBe('2026-08-14');

    // A sajtóforrás marad, a kormany.hu mellé kerül.
    expect(patch.sourceUrls).toEqual([
      'https://444.hu/2026/09/21/hutlen-kezeles',
      'https://kormany.hu/atlathato/feljelentes',
    ]);
    expect(patch.sourceNames).toEqual(['444.hu', 'kormany.hu (hivatalos)']);
  });
});
