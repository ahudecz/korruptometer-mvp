import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { fetchLiveStreamIds } from './youtube-podcast-sync';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

describe('fetchLiveStreamIds', () => {
  it('élőnek veszi az egykori élő adást, a most élőt és a beütemezettet; a sima videót nem', async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => ({
        items: [
          { id: 'past', snippet: { liveBroadcastContent: 'none' }, liveStreamingDetails: { actualEndTime: 'x' } },
          { id: 'now', snippet: { liveBroadcastContent: 'live' } },
          { id: 'soon', snippet: { liveBroadcastContent: 'upcoming' } },
          { id: 'vod', snippet: { liveBroadcastContent: 'none' } },
        ],
      }),
    }));
    const live = await fetchLiveStreamIds(['past', 'now', 'soon', 'vod'], 'k');
    expect([...live].sort()).toEqual(['now', 'past', 'soon']);
  });

  it('fail-closed: API-hibánál és a válaszból hiányzó videónál élőnek tekinti', async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({}) }));
    expect([...(await fetchLiveStreamIds(['a'], 'k'))]).toEqual(['a']);

    stubFetch(async () => ({ ok: true, json: async () => ({ items: [] }) }));
    expect([...(await fetchLiveStreamIds(['gone'], 'k'))]).toEqual(['gone']);

    stubFetch(async () => { throw new Error('network'); });
    expect([...(await fetchLiveStreamIds(['b'], 'k'))]).toEqual(['b']);
  });
});
