import { describe, expect, it } from 'vitest';

import { isoWeekKey, isRecommendable, pickRecommendations, RING_SIZE, type RecCase } from './case-recommendations';

const mk = (id: string): RecCase => ({
  id,
  name: `Ügy ${id}`,
  person: null,
  institution: null,
  damageHuf: '0',
  articleCount: 1,
});

// Szándékosan nem id-sorrendben — a függvénynek magának kell rendeznie.
const POOL = Array.from({ length: 200 }, (_, i) => mk(`ugy-${String((i * 37) % 200).padStart(3, '0')}`));

describe('ajánló ügyek (2026-09-29, SEO belső linkek)', () => {
  it('minden ügyre mutat legalább egy másik ügyoldal (a gyűrű garantálja)', () => {
    const inbound = new Map<string, number>();
    for (const c of POOL) {
      for (const r of pickRecommendations(POOL, { currentId: c.id, pageKey: `/adatbazis/${c.id}`, rotation: '2026-W40' })) {
        inbound.set(r.id, (inbound.get(r.id) ?? 0) + 1);
      }
    }
    const orphans = POOL.filter((c) => !inbound.has(c.id)).map((c) => c.id);
    expect(orphans).toEqual([]);
  });

  it('a gyűrű akkor is minden ügyet lefed, ha a kapcsolódó ügyek kizárnak elemeket', () => {
    const sorted = [...POOL].sort((a, b) => a.id.localeCompare(b.id));
    const inbound = new Set<string>();
    sorted.forEach((c, i) => {
      // Kizárjuk a gyűrű-szomszédot: a garanciának ettől még élnie kell.
      const next = sorted[(i + 1) % sorted.length]!.id;
      for (const r of pickRecommendations(POOL, { currentId: c.id, pageKey: c.id, rotation: 'x', excludeIds: [next] })) {
        inbound.add(r.id);
      }
    });
    expect(POOL.every((c) => inbound.has(c.id))).toBe(true);
  });

  it('az első helyeken a következő ügyek állnak id-sorrendben, körbeérve a végén', () => {
    const sorted = [...POOL].sort((a, b) => a.id.localeCompare(b.id));
    const last = sorted[sorted.length - 1]!;
    const recs = pickRecommendations(POOL, { currentId: last.id, pageKey: 'p', rotation: 'r' });
    expect(recs.slice(0, RING_SIZE).map((r) => r.id)).toEqual(sorted.slice(0, RING_SIZE).map((c) => c.id));
  });

  it('sosem ajánlja önmagát, sosem ismétel, és pontosan count elemet ad', () => {
    for (const c of POOL.slice(0, 50)) {
      const recs = pickRecommendations(POOL, { currentId: c.id, pageKey: c.id, rotation: '2026-W40', count: 6 });
      expect(recs).toHaveLength(6);
      expect(recs.map((r) => r.id)).not.toContain(c.id);
      expect(new Set(recs.map((r) => r.id)).size).toBe(6);
    }
  });

  it('a kizárt ügyeket a rotációs helyeken nem ajánlja', () => {
    const exclude = POOL.slice(0, 150).map((c) => c.id);
    const recs = pickRecommendations(POOL, { pageKey: '/', rotation: 'r', excludeIds: exclude, count: 10 });
    expect(recs).toHaveLength(10);
    for (const r of recs) expect(exclude).not.toContain(r.id);
  });

  it('determinisztikus: ugyanaz az oldal ugyanazon a héten ugyanazt adja', () => {
    const a = pickRecommendations(POOL, { pageKey: '/ugyek/nka-botrany', rotation: '2026-W40' });
    const b = pickRecommendations(POOL, { pageKey: '/ugyek/nka-botrany', rotation: '2026-W40' });
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
  });

  it('hétről hétre és oldalról oldalra más ügyeket ajánl', () => {
    const w40 = pickRecommendations(POOL, { pageKey: '/', rotation: '2026-W40' }).map((r) => r.id);
    const w41 = pickRecommendations(POOL, { pageKey: '/', rotation: '2026-W41' }).map((r) => r.id);
    const other = pickRecommendations(POOL, { pageKey: '/galeria/x', rotation: '2026-W40' }).map((r) => r.id);
    expect(w41).not.toEqual(w40);
    expect(other).not.toEqual(w40);
  });

  it('nem ügyoldalon (currentId nélkül) is működik, és kis poolnál sem akad el', () => {
    expect(pickRecommendations([], { pageKey: '/', rotation: 'r' })).toEqual([]);
    const two = [mk('a'), mk('b')];
    expect(pickRecommendations(two, { currentId: 'a', pageKey: 'a', rotation: 'r' }).map((r) => r.id)).toEqual(['b']);
  });

  it('egycikkes ügy nem kerülhet az ajánlóba (user-szabály, 2026-09-29)', () => {
    expect(isRecommendable({ articleCount: 0, damageHuf: '900000000' })).toBe(false);
    expect(isRecommendable({ articleCount: 1, damageHuf: '900000000' })).toBe(false);
    expect(isRecommendable({ articleCount: 2, damageHuf: '900000000' })).toBe(true);
  });

  it('500 millió Ft alatti ügy nem kerülhet az ajánlóba (user-szabály, 2026-09-29)', () => {
    expect(isRecommendable({ articleCount: 5, damageHuf: '0' })).toBe(false);
    expect(isRecommendable({ articleCount: 5, damageHuf: '499999999' })).toBe(false);
    expect(isRecommendable({ articleCount: 5, damageHuf: '500000000' })).toBe(true);
    expect(isRecommendable({ articleCount: 5, damageHuf: 'nem-szam' })).toBe(false);
  });

  it('isoWeekKey: évhatáron is helyes ISO-hetet ad', () => {
    expect(isoWeekKey(new Date('2026-09-29T12:00:00Z'))).toBe('2026-W40');
    expect(isoWeekKey(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53');
    expect(isoWeekKey(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
  });
});
