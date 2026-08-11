import { describe, expect, it } from 'vitest';
import { parseKontrollHomepage } from './kontroll';

/**
 * 2026-08-11 — kontroll.hu migrated off WordPress to Next.js; the old
 * `/feed/` RSS route now 404s. This fixture mimics the real homepage
 * layout: each article has TWO <a> tags sharing the same href — a plain
 * headline link and a `*maxFourRow`-classed lead-text link (CSS-module
 * hash prefix included, to prove we match on the substring, not the full
 * class name).
 */
function cardHtml(href: string, headline: string, lead: string, hashPrefix = 'e6WsXG'): string {
  return `
    <div class="fp-ha-info-container">
      <div class="pt-2 font-roboto-slab font-bold"><a href="${href}">${headline}</a></div>
      <div class="pt-3"><a class="_styles-module__${hashPrefix}__maxFourRow" href="${href}">${lead}</a></div>
    </div>
  `;
}

describe('parseKontrollHomepage', () => {
  it('pairs the headline link with its maxFourRow lead-text sibling and reads the date from the URL', () => {
    const href = '/cikk/belfold/2026/08/09/orban-a-mol-alelnokevel-mulatta-az-idot-szerbiaban';
    const html = `<html><body>${cardHtml(href, 'Orbán a Mol alelnökével múlatta az időt Szerbiában', 'Orbán a hétvégén Szerbiában járt egy zenei fesztiválon.')}</body></html>`;
    const articles = parseKontrollHomepage(html);
    expect(articles).toHaveLength(1);
    expect(articles[0]!.headline).toBe('Orbán a Mol alelnökével múlatta az időt Szerbiában');
    expect(articles[0]!.excerpt).toBe('Orbán a hétvégén Szerbiában járt egy zenei fesztiválon.');
    expect(articles[0]!.sourceUrl).toBe('https://kontroll.hu/cikk/belfold/2026/08/09/orban-a-mol-alelnokevel-mulatta-az-idot-szerbiaban');
    expect(articles[0]!.publishedAt.toISOString()).toBe('2026-08-09T00:00:00.000Z');
  });

  it('matches maxFourRow regardless of the CSS-module hash prefix (build-to-build churn)', () => {
    const href = '/cikk/belfold/2026/08/09/pelda-cikk';
    const html = `<html><body>${cardHtml(href, 'Cím', 'Hosszabb lead szöveg itt.', 'zZ9qLm')}</body></html>`;
    const articles = parseKontrollHomepage(html);
    expect(articles[0]!.excerpt).toBe('Hosszabb lead szöveg itt.');
  });

  it('dedupes multiple occurrences of the same href, keeping the longer text per bucket', () => {
    const href = '/cikk/belfold/2026/08/09/pelda-cikk';
    const html = `<html><body>
      <a href="${href}">Röv</a>
      <a href="${href}">Teljes cím itt</a>
      ${cardHtml(href, 'Teljes cím itt', 'Egy hosszú lead szöveg.')}
    </body></html>`;
    const articles = parseKontrollHomepage(html);
    expect(articles).toHaveLength(1);
    expect(articles[0]!.headline).toBe('Teljes cím itt');
  });

  it('skips links whose href has no parseable date (e.g. /rovat/... section links)', () => {
    const html = `<html><body><a href="/cikk/rovat-lista">Rovat</a></body></html>`;
    expect(parseKontrollHomepage(html)).toEqual([]);
  });

  it('skips empty-text anchors (image-wrapped duplicate links)', () => {
    const href = '/cikk/belfold/2026/08/09/pelda-cikk';
    const html = `<html><body>
      <a href="${href}"></a>
      ${cardHtml(href, 'Valódi cím', 'Lead.')}
    </body></html>`;
    const articles = parseKontrollHomepage(html);
    expect(articles).toHaveLength(1);
    expect(articles[0]!.headline).toBe('Valódi cím');
  });
});
