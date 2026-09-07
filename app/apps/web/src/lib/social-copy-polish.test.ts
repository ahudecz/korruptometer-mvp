import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { polishSocialCopy } from './social-copy-polish';

describe('polishSocialCopy', () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('passes the input through unchanged when OPENAI_API_KEY is not set (no network call)', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await polishSocialCopy({ triggerType: 'resignation', headline: 'X lemondott', detail: 'Y intézmény' });

    expect(result).toEqual({ headline: 'X lemondott', detail: 'Y intézmény' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('flattens an array detail into a single string in the fallback path', async () => {
    const result = await polishSocialCopy({ triggerType: 'poll_final_result', headline: 'Lezárult a szavazás', detail: ['1. A (40%)', '2. B (30%)'] });
    expect(result.detail).toBe('1. A (40%) 2. B (30%)');
  });

  it('returns the original text if the OpenAI call fails (fail-open)', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const result = await polishSocialCopy({ triggerType: 'court_verdict', headline: 'Z elítélve', detail: '5 év' });
    expect(result).toEqual({ headline: 'Z elítélve', detail: '5 év' });
  });

  it('returns the original text if OpenAI responds with a non-OK status', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }) as unknown as typeof fetch;

    const result = await polishSocialCopy({ triggerType: 'court_verdict', headline: 'Z elítélve', detail: '5 év' });
    expect(result).toEqual({ headline: 'Z elítélve', detail: '5 év' });
  });

  it('uses the polished headline/detail from a successful OpenAI response', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ headline: 'Ütősebb cím', detail: 'Ütősebb részlet' }) } }] }),
    }) as unknown as typeof fetch;

    const result = await polishSocialCopy({ triggerType: 'quiz_highlight', headline: 'Kvíz', detail: 'Intro' });
    expect(result).toEqual({ headline: 'Ütősebb cím', detail: 'Ütősebb részlet' });
  });

  it('falls back to the original detail when the model returns an empty detail for a non-empty input', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ headline: 'Ütősebb cím', detail: '' }) } }] }),
    }) as unknown as typeof fetch;

    const result = await polishSocialCopy({ triggerType: 'quiz_highlight', headline: 'Kvíz', detail: 'Eredeti intro' });
    expect(result).toEqual({ headline: 'Ütősebb cím', detail: 'Eredeti intro' });
  });
});
