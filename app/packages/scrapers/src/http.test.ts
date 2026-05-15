import { afterEach, describe, expect, it } from 'vitest';

import {
  HttpStatusError,
  httpGet,
  httpGetWithArchiveFallback,
  _resetHttpStateForTests,
} from './http';

const PRIMARY = 'https://example.test/article';
const ARCHIVE = 'https://web.archive.org/web/20260101/https://example.test/article';

function makeFetch(responses: Partial<Record<string, { status: number; body: string }>>) {
  const calls: string[] = [];
  const impl: typeof fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push(url);
    if (url.endsWith('/robots.txt')) {
      return new Response('', { status: 200 });
    }
    const r = responses[url];
    if (!r) {
      throw new Error(`unmocked URL: ${url}`);
    }
    return new Response(r.body, { status: r.status });
  };
  return { impl, calls };
}

afterEach(() => {
  _resetHttpStateForTests();
});

describe('HttpStatusError', () => {
  it('exposes status and url', async () => {
    const { impl } = makeFetch({ [PRIMARY]: { status: 404, body: '' } });
    await expect(httpGet(PRIMARY, { fetchImpl: impl })).rejects.toMatchObject({
      name: 'HttpStatusError',
      status: 404,
      url: PRIMARY,
    });
  });
});

describe('httpGetWithArchiveFallback (FR-080)', () => {
  it('returns the primary body when the primary URL succeeds (viaArchive=false)', async () => {
    const { impl, calls } = makeFetch({
      [PRIMARY]: { status: 200, body: '<html>primary</html>' },
    });
    const out = await httpGetWithArchiveFallback(PRIMARY, ARCHIVE, { fetchImpl: impl });
    expect(out.viaArchive).toBe(false);
    expect(out.html).toBe('<html>primary</html>');
    expect(calls.some((c) => c === PRIMARY)).toBe(true);
    expect(calls.some((c) => c === ARCHIVE)).toBe(false);
  });

  it('falls back to the archive when primary returns 404 (viaArchive=true)', async () => {
    const { impl, calls } = makeFetch({
      [PRIMARY]: { status: 404, body: '' },
      [ARCHIVE]: { status: 200, body: '<html>from-wayback</html>' },
    });
    const out = await httpGetWithArchiveFallback(PRIMARY, ARCHIVE, { fetchImpl: impl });
    expect(out.viaArchive).toBe(true);
    expect(out.html).toBe('<html>from-wayback</html>');
    expect(calls.some((c) => c === PRIMARY)).toBe(true);
    expect(calls.some((c) => c === ARCHIVE)).toBe(true);
  });

  it('falls back on 410 too', async () => {
    const { impl } = makeFetch({
      [PRIMARY]: { status: 410, body: '' },
      [ARCHIVE]: { status: 200, body: '<html>gone-then-archived</html>' },
    });
    const out = await httpGetWithArchiveFallback(PRIMARY, ARCHIVE, { fetchImpl: impl });
    expect(out.viaArchive).toBe(true);
    expect(out.html).toBe('<html>gone-then-archived</html>');
  });

  it('does NOT fall back on non-404/410 errors (e.g. 401)', async () => {
    const { impl } = makeFetch({ [PRIMARY]: { status: 401, body: '' } });
    await expect(
      httpGetWithArchiveFallback(PRIMARY, ARCHIVE, { fetchImpl: impl }),
    ).rejects.toBeInstanceOf(HttpStatusError);
  });

  it('rethrows the 404 when no archive URL was provided', async () => {
    const { impl } = makeFetch({ [PRIMARY]: { status: 404, body: '' } });
    await expect(
      httpGetWithArchiveFallback(PRIMARY, null, { fetchImpl: impl }),
    ).rejects.toMatchObject({ name: 'HttpStatusError', status: 404 });
  });
});
