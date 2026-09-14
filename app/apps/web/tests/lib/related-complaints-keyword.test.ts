import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ getDb: () => ({}), schema: {} }));

import { matchesKeyword } from '@/lib/related-complaints';

/**
 * 2026-09-14 — user report: az /ugyek/nka-botrany oldalon két, az ügyhöz
 * semmilyen módon nem kapcsolódó feljelentés jelent meg, mert az "NKA"
 * kulcsszó egy SZÓ BELSEJÉBE illeszkedett ("munkatársát", "Simonka").
 */
describe('matchesKeyword — rövidítés-kulcsszó szóhatárhoz kötése', () => {
  it('nem illeszkedik szó belsejében (az élesben látott két téves találat)', () => {
    expect(
      matchesKeyword(
        'Hadházy Ákos feljelentése után a Fidesz-közeli Alapjogokért Központ munkatársát vádolják.',
        'NKA',
      ),
    ).toBe(false);
    expect(
      matchesKeyword('Simonka György — hivatali visszaélés ügye', 'NKA'),
    ).toBe(false);
  });

  it('illeszkedik önálló szóként és kötőjeles toldalékkal is', () => {
    expect(matchesKeyword('Az NKA pénzeiből finanszírozták.', 'NKA')).toBe(true);
    expect(matchesKeyword('Újabb fejezet az NKA-botrányból.', 'NKA')).toBe(true);
    expect(matchesKeyword('a Radics Bélához köthető NKA-s pénzekből', 'NKA')).toBe(true);
    expect(matchesKeyword('NKA', 'NKA')).toBe(true);
  });

  it('a rövidítés kis-nagybetű-érzékeny, a többi kulcsszó nem', () => {
    expect(matchesKeyword('a nka valamiért kisbetűs', 'NKA')).toBe(false);
    expect(matchesKeyword('hankó balázs volt miniszter', 'Hankó Balázs')).toBe(true);
    expect(matchesKeyword('a nemzeti kulturális alap kerete', 'Nemzeti Kulturális Alap')).toBe(true);
  });

  it('más ügyek rövidítéseit sem engedi szó belsejébe', () => {
    expect(matchesKeyword('a kormány navigációs rendszere', 'NAV')).toBe(false);
    expect(matchesKeyword('A NAV nyomoz az ügyben.', 'NAV')).toBe(true);
  });
});
