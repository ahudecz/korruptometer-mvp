import { test, expect } from '@playwright/test';

/**
 * T047 — footer-link crawl. Visit every public page and assert every visible
 * footer `<a href>` returns HTTP 200 (US4 acceptance scenario 1, SC-003,
 * FR-024).
 */
const PAGES = ['/', '/galeria', '/adatbazis', '/hamarosan', '/hirek', '/bejelentes'];

for (const route of PAGES) {
  test(`footer links on ${route} are 200`, async ({ page, request }) => {
    await page.goto(route);
    const hrefs = await page.locator('footer a[href]').evaluateAll((els) =>
      els
        .map((e) => (e as HTMLAnchorElement).getAttribute('href'))
        .filter((h): h is string => !!h && !h.startsWith('mailto:') && !h.startsWith('http')),
    );
    const unique = Array.from(new Set(hrefs));
    for (const href of unique) {
      const target = href.startsWith('/') ? href : `/${href}`;
      const res = await request.get(target, { failOnStatusCode: false });
      expect(res.status(), `${route} → ${target} returned ${res.status()}`).toBe(200);
    }
  });
}
