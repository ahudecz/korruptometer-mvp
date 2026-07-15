import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { classifyVideoTier } from './youtube-podcast-sync';
import type { PodcastChannelConfig } from '@app/_home/podcast-channels-config';

describe('classifyVideoTier', () => {
  const alwaysRelevantChannel: PodcastChannelConfig = {
    slug: 'juhasz-peter',
    handle: '@juhaszpetervideo',
    name: 'Juhász Péter | Juhi',
    alwaysRelevant: true,
    viewThreshold: 0,
  };
  const maybeChannel: PodcastChannelConfig = {
    slug: 'unknown',
    handle: '@unknown',
    name: 'Unknown',
    relevantByDefault: true,
    viewThreshold: 1000,
  };
  const strictChannel: PodcastChannelConfig = {
    slug: 'kontroll',
    handle: '@kontrollhu',
    name: 'Kontroll',
    relevantByDefault: false,
    viewThreshold: 50000,
  };

  it('"in" egy alwaysRelevant csatornánál, kulcsszó nélkül is', () => {
    expect(classifyVideoTier({ videoId: 'x', title: 'Random napi vlog', description: '', publishedAt: new Date() }, alwaysRelevantChannel)).toBe('in');
  });

  it('"in" ha a cím/leírás kulcsszót tartalmaz, akkor is ha a csatorna maga nem alwaysRelevant', () => {
    expect(classifyVideoTier({ videoId: 'x', title: 'Orbán Viktor botránya', description: '', publishedAt: new Date() }, strictChannel)).toBe('in');
  });

  it('"maybe" ha relevantByDefault csatorna, de nincs kulcsszó-egyezés', () => {
    expect(classifyVideoTier({ videoId: 'x', title: 'Random napi vlog', description: '', publishedAt: new Date() }, maybeChannel)).toBe('maybe');
  });

  it('"out" ha nem relevantByDefault és nincs kulcsszó-egyezés', () => {
    expect(classifyVideoTier({ videoId: 'x', title: 'Random napi vlog', description: '', publishedAt: new Date() }, strictChannel)).toBe('out');
  });
});
