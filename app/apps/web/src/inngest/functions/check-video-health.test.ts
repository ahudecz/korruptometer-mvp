import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ getDb: () => ({}), schema: {} }));
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: vi.fn() }));

import { collectStaticVideoIds, findBrokenVideos, promotionFor, type VideoRef } from './check-video-health';

const ok = (id: string) => ({ id, status: { privacyStatus: 'public', embeddable: true } });

describe('findBrokenVideos', () => {
  const refs: VideoRef[] = [
    { videoId: 'aaa', label: 'PODCAST: x', source: 'podcast' },
    { videoId: 'bbb', label: 'ÜGYOLDAL: y', source: 'static' },
    { videoId: 'ccc', label: 'ÜGYOLDAL: z', source: 'static' },
  ];

  it('a lekérdezett, de vissza nem jött videó hibás', () => {
    const broken = findBrokenVideos(refs, { bbb: ok('bbb'), ccc: ok('ccc') }, ['aaa', 'bbb', 'ccc']);
    expect(broken.map((b) => b.videoId)).toEqual(['aaa']);
  });

  it('az elszállt hívásban lévő videó NEM hibás (különben API-kiesésnél mindent törölne)', () => {
    const broken = findBrokenVideos(refs, { bbb: ok('bbb') }, ['bbb']);
    expect(broken).toEqual([]);
  });

  it('privát → hibás', () => {
    const broken = findBrokenVideos(refs, { aaa: { id: 'aaa', status: { privacyStatus: 'private' } }, bbb: ok('bbb'), ccc: ok('ccc') }, ['aaa', 'bbb', 'ccc']);
    expect(broken[0]?.reason).toBe('privát');
  });

  it('beágyazás-tiltás csak akkor hiba, ha nem minden hely linkOnly', () => {
    const noEmbed = { id: 'ddd', status: { privacyStatus: 'public', embeddable: false } };
    expect(findBrokenVideos([{ videoId: 'ddd', label: 'x', source: 'static', linkOnly: true }], { ddd: noEmbed }, ['ddd'])).toEqual([]);
    expect(findBrokenVideos([{ videoId: 'ddd', label: 'x', source: 'static' }], { ddd: noEmbed }, ['ddd'])).toHaveLength(1);
  });
});

describe('promotionFor', () => {
  const ref: VideoRef = {
    videoId: 'hero',
    label: 'ÜGYOLDAL',
    source: 'static',
    featured: true,
    siblings: [
      { videoId: 'dead2', title: 'Második', where: 'videósor' },
      { videoId: 'alive', title: 'Harmadik', where: 'videósor' },
    ],
  };

  it('az első működő testvér lép elő, a szintén hibásat átugorja', () => {
    expect(promotionFor(ref, new Set(['hero', 'dead2']))?.videoId).toBe('alive');
  });

  it('egyedüli videónál nincs előléptetés', () => {
    expect(promotionFor({ ...ref, siblings: [] }, new Set(['hero']))).toBeNull();
  });
});

describe('collectStaticVideoIds', () => {
  it('minden kézi hely kap olvasható címkét, és az ügyoldalak útvonalat', () => {
    const refs = collectStaticVideoIds();
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.every((r) => r.source === 'static' && r.label.length > 0)).toBe(true);
    expect(refs.filter((r) => r.label.startsWith('ÜGYOLDAL')).every((r) => r.path?.startsWith('/ugyek/'))).toBe(true);
  });
});
