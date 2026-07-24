import { afterEach, describe, expect, it } from 'vitest';

import { fetchArticleBodyTransient } from './full-text-fetch';
import { _resetHttpStateForTests } from './http';

const URL = 'https://example.test/cikk/valami-tortenet';

function makeFetch(status: number, body: string): typeof fetch {
  return async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/robots.txt')) return new Response('', { status: 200 });
    return new Response(body, { status });
  };
}

afterEach(() => {
  _resetHttpStateForTests();
});

describe('fetchArticleBodyTransient', () => {
  it('extracts the paragraph group with the most cumulative text, skipping nav noise', async () => {
    const html = `
      <html><body>
        <nav><p>Kezdőlap</p><p>Rovatok</p></nav>
        <div class="article-body">
          <p>Ez az első bekezdés, amely a cikk tényleges tartalmát írja le részletesen.</p>
          <p>Ez a második bekezdés, amely folytatja a történetet további részletekkel.</p>
          <p>Egy harmadik bekezdés is szükséges, hogy a szöveg elérje a minimális hosszt biztosan.</p>
        </div>
        <aside><p>Kapcsolódó cikkek</p></aside>
      </body></html>
    `;
    const text = await fetchArticleBodyTransient(URL, { fetchImpl: makeFetch(200, html) });
    expect(text).toContain('első bekezdés');
    expect(text).toContain('harmadik bekezdés');
    expect(text).not.toContain('Kezdőlap');
    expect(text).not.toContain('Kapcsolódó cikkek');
  });

  it('returns null for a short paywall/error page (below the viability floor)', async () => {
    const html = `<html><body><p>Az oldal nem elérhető.</p></body></html>`;
    const text = await fetchArticleBodyTransient(URL, { fetchImpl: makeFetch(200, html) });
    expect(text).toBeNull();
  });

  it('returns null on a 403 (fail-open — caller falls back to cross-outlet)', async () => {
    const text = await fetchArticleBodyTransient(URL, { fetchImpl: makeFetch(403, '') });
    expect(text).toBeNull();
  });

  it('returns null when the page has no <p> tags at all', async () => {
    const html = `<html><body><div>Csak sima szöveg, se bekezdés, se semmi más.</div></body></html>`;
    const text = await fetchArticleBodyTransient(URL, { fetchImpl: makeFetch(200, html) });
    expect(text).toBeNull();
  });

  it('truncates to the max character budget', async () => {
    const longParagraph = 'A'.repeat(5000);
    const html = `<html><body><div class="article-body"><p>${longParagraph}</p></div></body></html>`;
    const text = await fetchArticleBodyTransient(URL, { fetchImpl: makeFetch(200, html) });
    expect(text?.length).toBe(4000);
  });
});
