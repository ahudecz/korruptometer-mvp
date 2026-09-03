import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const {
  buildDigestDraft,
  newDigestCode,
  passesFloor,
  renderTemplateBody,
  DIGEST_CODE_CHARS,
  DIGEST_MIN_ITEMS,
  DIGEST_REENGAGE_DAYS,
  WATCHLIST_ID_MAX,
} = await import('@/lib/digest-build');

const { WATCH_LIST } = await import('@app/_home/watchlist-config');

type Item = Parameters<typeof passesFloor>[0][number];

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID(),
    section: 'resignation',
    title: 'Kovács Béla',
    detail: 'Államtitkár',
    url: 'https://www.kegyencjarat.hu/lemondasok',
    occurredAt: new Date('2026-08-30T10:00:00Z'),
    ...overrides,
  };
}

const NOW = new Date('2026-09-01T07:05:00Z');

describe('the floor (FR-057, V7)', () => {
  it('returns null below DIGEST_MIN_ITEMS with no exempt section and a recent send', async () => {
    const draft = await buildDigestDraft({
      items: [item(), item()],
      periodStart: new Date('2026-08-25T07:05:00Z'),
      periodEnd: NOW,
      lastSentAt: new Date('2026-08-25T07:05:00Z'),
      now: NOW,
    });
    expect(draft).toBeNull();
  });

  it('an empty window never produces a draft', () => {
    expect(passesFloor([], null, NOW)).toBe(false);
  });

  it('DIGEST_MIN_ITEMS items open the floor', () => {
    const items = Array.from({ length: DIGEST_MIN_ITEMS }, () => item());
    expect(passesFloor(items, new Date('2026-08-31T00:00:00Z'), NOW)).toBe(true);
  });

  it('ONE watchlist removal opens the floor on its own', () => {
    expect(
      passesFloor([item({ section: 'watchlist_removal' })], new Date('2026-08-31T00:00:00Z'), NOW),
    ).toBe(true);
  });

  it('ONE court verdict opens the floor on its own', () => {
    expect(
      passesFloor([item({ section: 'court_verdict' })], new Date('2026-08-31T00:00:00Z'), NOW),
    ).toBe(true);
  });

  it('a long silence opens the floor after DIGEST_REENGAGE_DAYS', () => {
    const longAgo = new Date(NOW.getTime() - (DIGEST_REENGAGE_DAYS + 1) * 24 * 60 * 60_000);
    expect(passesFloor([item()], longAgo, NOW)).toBe(true);
    const recent = new Date(NOW.getTime() - 2 * 24 * 60 * 60_000);
    expect(passesFloor([item()], recent, NOW)).toBe(false);
  });
});

describe('the spend gate NEVER suppresses a digest (FR-058, V7)', () => {
  const items = Array.from({ length: 4 }, () => item());

  it('a REFUSING spend gate still produces a complete draft', async () => {
    const refusing = vi.fn(async () => ({ allowed: false }));
    const writeSummary = vi.fn(async () => 'ezt sosem hívjuk');

    const draft = await buildDigestDraft({
      items,
      periodStart: new Date('2026-08-25T07:05:00Z'),
      periodEnd: NOW,
      lastSentAt: null,
      now: NOW,
      spendGate: refusing,
      writeSummary,
    });

    expect(draft).not.toBeNull();
    expect(refusing).toHaveBeenCalled();
    expect(writeSummary).not.toHaveBeenCalled();
    // Minden NOT NULL oszlop meg van nevezve.
    expect(draft!.cadence).toBe('weekly');
    expect(draft!.subjectHu.length).toBeGreaterThan(0);
    expect(draft!.bodyText.length).toBeGreaterThan(0);
    expect(draft!.bodyHtml.length).toBeGreaterThan(0);
    expect(draft!.alertIds).toHaveLength(items.length);
    expect(draft!.periodStart).toBeInstanceOf(Date);
    expect(draft!.periodEnd).toBeInstanceOf(Date);
  });

  it('the refused draft says the summary was skipped, rather than hiding it', async () => {
    const draft = await buildDigestDraft({
      items,
      periodStart: new Date('2026-08-25T07:05:00Z'),
      periodEnd: NOW,
      lastSentAt: null,
      now: NOW,
      spendGate: async () => ({ allowed: false }),
    });
    expect(draft!.bodyText).toContain('összegzés');
  });

  it('a THROWING summary writer also produces a draft, not an exception', async () => {
    const draft = await buildDigestDraft({
      items,
      periodStart: new Date('2026-08-25T07:05:00Z'),
      periodEnd: NOW,
      lastSentAt: null,
      now: NOW,
      spendGate: async () => ({ allowed: true }),
      writeSummary: async () => {
        throw new Error('model down');
      },
    });
    expect(draft).not.toBeNull();
  });

  it('an ALLOWING gate lets the summary through into the body', async () => {
    const draft = await buildDigestDraft({
      items,
      periodStart: new Date('2026-08-25T07:05:00Z'),
      periodEnd: NOW,
      lastSentAt: null,
      now: NOW,
      spendGate: async () => ({ allowed: true }),
      writeSummary: async () => 'A héten négy új tétel került fel.',
    });
    expect(draft!.bodyText).toContain('A héten négy új tétel került fel.');
  });
});

describe('the short digest code, and the callback_data budget (FR-073, V3)', () => {
  it('is DIGEST_CODE_CHARS characters long', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(newDigestCode()).toHaveLength(DIGEST_CODE_CHARS);
    }
  });

  it('`dg:a:{code}` fits Telegram\'s 64-byte callback_data limit with room to spare', () => {
    const code = newDigestCode();
    for (const prefix of ['dg:a:', 'dg:x:', 'dg:r:']) {
      expect(Buffer.byteLength(`${prefix}${code}`)).toBeLessThanOrEqual(64);
    }
    expect(Buffer.byteLength(`dg:a:${code}`)).toBe(13);
  });

  it('every WATCH_LIST id is at most WATCHLIST_ID_MAX characters — the tight existing case', () => {
    // `a:wc:{personId}.{articleId}` a legszorosabb meglévő gomb-adat. Ha egy
    // új figyelt személy hosszabb azonosítót kapna, az a gomb csendben túllépné
    // a 64 bájtot, és a Telegram elutasítaná az üzenetet.
    for (const person of WATCH_LIST) {
      expect(person.id.length).toBeLessThanOrEqual(WATCHLIST_ID_MAX);
    }
    const longest = Math.max(...WATCH_LIST.map((p) => p.id.length));
    const uuidLength = 36;
    expect(Buffer.byteLength(`a:wc:${'x'.repeat(longest)}.${'y'.repeat(uuidLength)}`)).toBeLessThanOrEqual(64);
  });
});

describe('the rendered body', () => {
  it('groups items by section and carries every link', () => {
    const items = [
      item({ section: 'resignation', title: 'A', url: 'https://x/1' }),
      item({ section: 'court_verdict', title: 'B', url: 'https://x/2' }),
    ];
    const { text, html } = renderTemplateBody(items);
    for (const needle of ['A', 'B', 'https://x/1', 'https://x/2']) {
      expect(text).toContain(needle);
      expect(html).toContain(needle);
    }
    expect(text).toContain('LEMONDÁSOK ÉS KIRÚGÁSOK');
    expect(html).toContain('Bírósági ítéletek');
  });

  it('a resume-day digest says so in its first line (FR-067)', () => {
    const { text } = renderTemplateBody([item()], { resumeDay: 2 });
    expect(text.split('\n')[0]).toContain('2. napi részlete');
  });

  it('carries the unsubscribe link when one is given', () => {
    const { text, html } = renderTemplateBody([item()], {
      unsubscribeUrl: 'https://www.kegyencjarat.hu/hirlevel/leiratkozas?t=T',
    });
    expect(text).toContain('Leiratkozás:');
    expect(html).toContain('/hirlevel/leiratkozas?t=T');
  });
});
