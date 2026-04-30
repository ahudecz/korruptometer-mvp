import { describe, expect, it } from 'vitest';

import { frissitveRelative } from './relative-time';

describe('frissitveRelative', () => {
  const NOW = new Date('2026-04-30T12:00:00Z');

  it('returns "épp most" under one minute', () => {
    expect(frissitveRelative(new Date('2026-04-30T11:59:30Z'), NOW)).toBe(
      'frissítve épp most',
    );
  });

  it('formats minutes', () => {
    expect(frissitveRelative(new Date('2026-04-30T11:55:00Z'), NOW)).toBe(
      'frissítve 5 perccel ezelőtt',
    );
  });

  it('formats hours', () => {
    expect(frissitveRelative(new Date('2026-04-30T09:00:00Z'), NOW)).toBe(
      'frissítve 3 órával ezelőtt',
    );
  });

  it('formats days', () => {
    expect(frissitveRelative(new Date('2026-04-28T12:00:00Z'), NOW)).toBe(
      'frissítve 2 napja',
    );
  });

  it('rounds DOWN to the latest fully-elapsed unit (never overstates)', () => {
    // 119 seconds → 1 minute, not 2
    expect(frissitveRelative(new Date('2026-04-30T11:58:01Z'), NOW)).toBe(
      'frissítve 1 perccel ezelőtt',
    );
  });
});
