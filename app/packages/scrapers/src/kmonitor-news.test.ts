import { describe, expect, it } from 'vitest';
import { parseKmonitorHomepage } from './kmonitor-news';

/**
 * 2026-08-11 — k-monitor.hu's `/feed` route now 404s. The homepage links
 * to K-Monitor's OWN articles (`/cikkek/{yyyymmdd}-{slug}`) but also press-
 * reviews OTHER outlets' corruption coverage (rtl.hu, kontroll.hu, ...) —
 * only own-domain links should be picked up (those other outlets have
 * their own adapters already). Each own-article link's text is the
 * headline immediately followed by a Hungarian date stamp ("2026. július
 * 30.") and then the lead paragraph, with no separate markup boundary.
 */
describe('parseKmonitorHomepage', () => {
  it('extracts an own-domain article, splitting headline from the lead paragraph at the embedded date stamp', () => {
    const href = 'https://www.k-monitor.hu/cikkek/20260730-az-uj-orszaggyules-ujra-izgalmassa-tette';
    const text = 'Az új Országgyűlés újra izgalmassá tette a parlamenti vitákat 2026. július 30. Intenzív parlamenti munka követte az áprilisi választásokat.';
    const html = `<html><body><a href="${href}">${text}</a></body></html>`;
    const articles = parseKmonitorHomepage(html);
    expect(articles).toHaveLength(1);
    expect(articles[0]!.headline).toBe('Az új Országgyűlés újra izgalmassá tette a parlamenti vitákat');
    expect(articles[0]!.excerpt).toBe('Intenzív parlamenti munka követte az áprilisi választásokat.');
    expect(articles[0]!.sourceUrl).toBe(href);
    expect(articles[0]!.publishedAt.toISOString()).toBe('2026-07-30T00:00:00.000Z');
  });

  it('ignores links to other outlets even when they are corruption-adjacent (press-review style homepage)', () => {
    const html = `<html><body>
      <a href="https://rtl.hu/hazon-kivul/2026/08/02/lazar-janos">Lázár János-cikk az RTL-en</a>
      <a href="https://kontroll.hu/cikk/belfold/2026/07/28/felallt-a-szuperhatosag">Kontroll-cikk</a>
    </body></html>`;
    expect(parseKmonitorHomepage(html)).toEqual([]);
  });

  it('falls back to the full link text as the headline when no date stamp is embedded', () => {
    const href = 'https://www.k-monitor.hu/cikkek/20260730-cim-datumbelyeg-nelkul';
    const html = `<html><body><a href="${href}">Rövid cím lead nélkül</a></body></html>`;
    const articles = parseKmonitorHomepage(html);
    expect(articles[0]!.headline).toBe('Rövid cím lead nélkül');
    expect(articles[0]!.excerpt).toBe('');
  });

  it('returns an empty array when there are no matching links', () => {
    expect(parseKmonitorHomepage('<html><body><p>nincs cikk</p></body></html>')).toEqual([]);
  });
});
