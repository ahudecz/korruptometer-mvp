import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RESEND_BATCH_MAX, sendBatch, unsubscribeHeaders } from './email';

/** 012-reader-subscriptions — E1…E3 a contracts/resend-webhook.md szerint. */
const fetchMock = vi.fn();

const MESSAGE = {
  to: 'olvaso@example.hu',
  subject: 'Kegyencjárat — heti összefoglaló',
  text: 'szöveg',
  html: '<p>szöveg</p>',
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.RESEND_FROM = 'Kegyencjárat <hirlevel@mail.kegyencjarat.hu>';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  delete process.env.RESEND_UNSUBSCRIBE_MAILBOX;
});

describe('sendBatch (E1, E2, FR-047)', () => {
  it('E1 — with RESEND_API_KEY unset returns { sent: 0, failed: 0 } and performs NO fetch', async () => {
    await expect(sendBatch([MESSAGE])).resolves.toEqual({ sent: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('E2 — never throws on a network rejection; reports the failure count instead', async () => {
    process.env.RESEND_API_KEY = 're_test';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    const result = await sendBatch([MESSAGE, MESSAGE]);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.error).toContain('ECONNRESET');
  });

  it('E2 — never throws on a 500', async () => {
    process.env.RESEND_API_KEY = 're_test';
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(sendBatch([MESSAGE])).resolves.toEqual({
      sent: 0,
      failed: 1,
      error: 'resend 500',
    });
  });

  it('E2 — never throws on a malformed body', async () => {
    process.env.RESEND_API_KEY = 're_test';
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ nonsense: true }) });
    const result = await sendBatch([MESSAGE]);
    expect(result.failed).toBe(1);
    expect(result.error).toBe('malformed resend response');
  });

  it('reports what was actually accepted', async () => {
    process.env.RESEND_API_KEY = 're_test';
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: '1' }, { id: '2' }] }),
    });
    await expect(sendBatch([MESSAGE, MESSAGE, MESSAGE])).resolves.toEqual({ sent: 2, failed: 1 });
  });

  it('sends from RESEND_FROM, which must be the mail. subdomain and never the apex', async () => {
    process.env.RESEND_API_KEY = 're_test';
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [{ id: '1' }] }) });
    await sendBatch([MESSAGE]);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Array<{ from: string }>;
    expect(body[0]!.from).toContain('@mail.kegyencjarat.hu');
  });

  it('refuses an over-size batch rather than silently dropping the tail', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const oversize = Array.from({ length: RESEND_BATCH_MAX + 1 }, () => MESSAGE);
    const result = await sendBatch(oversize);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(oversize.length);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an empty batch is a no-op', async () => {
    process.env.RESEND_API_KEY = 're_test';
    await expect(sendBatch([])).resolves.toEqual({ sent: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('unsubscribeHeaders (E3, FR-042)', () => {
  const url = 'https://www.kegyencjarat.hu/hirlevel/leiratkozas?t=TOKEN';

  it('emits List-Unsubscribe-Post exactly as Gmail expects it', () => {
    expect(unsubscribeHeaders(url)['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('carries a mailto: value ALONGSIDE the https: one — a scanner cannot trigger a mailto', () => {
    const header = unsubscribeHeaders(url)['List-Unsubscribe']!;
    expect(header).toContain(`<${url}>`);
    expect(header).toMatch(/<mailto:[^>]+\?subject=unsubscribe>/);
  });

  it('is a pure function of its argument plus the mailbox setting', () => {
    process.env.RESEND_UNSUBSCRIBE_MAILBOX = 'leiratkozas@mail.kegyencjarat.hu';
    expect(unsubscribeHeaders(url)['List-Unsubscribe']).toContain(
      'mailto:leiratkozas@mail.kegyencjarat.hu',
    );
  });
});
