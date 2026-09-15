import { describe, expect, it } from 'vitest';

import { MAX_REELS_PER_AUTHOR, REEL_SECTION_LIMIT } from './reels-config';
import { pickReels, type ReelRow } from './reels-select';

function row(
  id: string,
  authorName: string,
  opts: { postUrl?: string; imageUrl?: string | null } = {},
): ReelRow {
  return {
    id,
    authorName,
    postUrl: opts.postUrl ?? `https://www.facebook.com/reel/${id}`,
    imageUrl: opts.imageUrl === undefined ? 'https://example.test/poster.jpg' : opts.imageUrl,
    content: null,
    postedAt: null,
  };
}

describe('pickReels', () => {
  it('szerzőnként legfeljebb MAX_REELS_PER_AUTHOR reelt enged', () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(`m${i}`, 'Molnár Áron'));
    expect(pickReels(rows)).toHaveLength(MAX_REELS_PER_AUTHOR);
  });

  it('megtartja a bemeneti (frissesség szerinti) sorrendet', () => {
    const picked = pickReels([row('1', 'Átlátszó'), row('2', 'Juhász Péter'), row('3', 'aHang')]);
    expect(picked.map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('összesen sem ad többet REEL_SECTION_LIMIT-nél', () => {
    const rows = Array.from({ length: REEL_SECTION_LIMIT + 8 }, (_, i) => row(`x${i}`, `Szerző ${i}`));
    expect(pickReels(rows)).toHaveLength(REEL_SECTION_LIMIT);
  });

  it('a nem lejátszható posztot eldobja, és az NEM eszi el a szerző kvótáját', () => {
    const picked = pickReels([
      row('a', 'Átlátszó', { postUrl: 'https://www.facebook.com/atlatszo/posts/111' }),
      row('b', 'Átlátszó'),
    ]);
    expect(picked.map((r) => r.id)).toEqual(['b']);
  });

  it('a frissebb reelt adja akkor is, ha annak nincs poszterképe', () => {
    // 2026-09-15: ezt egyszer fordítva csináltuk, és a rács 2 hónapos
    // videókra cserélte a hetes friss tartalmat — a hiányzó thumbnail nem
    // ok arra, hogy régebbi videót mutassunk.
    const picked = pickReels([
      row('friss-kep-nelkul', 'Juhász Péter', { imageUrl: null }),
      row('regebbi-kepes', 'Juhász Péter'),
    ]);
    expect(picked.map((r) => r.id)).toEqual(['friss-kep-nelkul']);
  });

  it('üres bemenetre üres', () => {
    expect(pickReels([])).toEqual([]);
  });
});
