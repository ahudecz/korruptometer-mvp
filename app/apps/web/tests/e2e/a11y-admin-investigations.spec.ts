import { expect, test } from '@playwright/test';
import { axe, expectNoSerious } from './axe-config';

/**
 * T086 — Playwright + axe sweep for the new investigation-engine admin
 * routes. Skips when the admin login redirects an unauth browser
 * (consistent with the existing a11y-admin-* specs).
 */
test('/admin/investigations is axe-clean', async ({ page }) => {
  const response = await page.goto('/admin/investigations');
  if (
    response
    && (response.status() === 302
      || response.status() === 401
      || response.url().includes('/admin/login'))
  ) {
    test.skip(true, 'admin investigations requires a session — skipping in unauth env');
    return;
  }
  const results = await axe(page).analyze();
  expectNoSerious(results);
});

test('/admin/investigations/llm-usage is axe-clean', async ({ page }) => {
  const response = await page.goto('/admin/investigations/llm-usage');
  if (
    response
    && (response.status() === 302
      || response.status() === 401
      || response.url().includes('/admin/login'))
  ) {
    test.skip(true, 'llm-usage requires a session — skipping in unauth env');
    return;
  }
  const results = await axe(page).analyze();
  expectNoSerious(results);
});

/**
 * T129 — pipeline flips to `running` within 3 s after a POST /xref, and to
 * `done` or `failed` within 30 s without a manual reload.
 *
 * Requires an authenticated reviewer session AND at least one open
 * investigation in the database. Skipped in unauth env (same gate as the
 * other admin specs).
 */
test('T129 pipeline panel reacts to a triggered xref', async ({ page }) => {
  const response = await page.goto('/admin/investigations');
  if (
    response
    && (response.status() === 302
      || response.status() === 401
      || response.url().includes('/admin/login'))
  ) {
    test.skip(true, 'admin investigations requires a session');
    return;
  }
  const firstCase = page.locator('.rail-item a').first();
  if ((await firstCase.count()) === 0) {
    test.skip(true, 'no investigation rows available');
    return;
  }
  await firstCase.click();
  await page.waitForURL(/admin\/investigations\/[^/]+/);
  const xrefButton = page.getByRole('button', {
    name: 'Cross-reference futtatása',
  });
  if ((await xrefButton.count()) === 0) {
    test.skip(true, 'cross-reference button not surfaced for this case');
    return;
  }
  await xrefButton.click();
  const xrefRow = page.locator('.pipeline-row').filter({ hasText: 'Cross-reference' });
  await expect(xrefRow.locator('.pipeline-state')).toContainText(
    /fut|kész|hiba/,
    { timeout: 3000 },
  );
  await expect(xrefRow.locator('.pipeline-state')).toContainText(/kész|hiba/, {
    timeout: 30000,
  });
});

/**
 * T151 — every rendered admin-investigations page surface is free of raw
 * HTTP status codes, English error verbs, and internal error symbols.
 */
test('T151 detail page has no raw error tokens in the DOM', async ({ page }) => {
  const response = await page.goto('/admin/investigations');
  if (
    response
    && (response.status() === 302
      || response.status() === 401
      || response.url().includes('/admin/login'))
  ) {
    test.skip(true, 'admin investigations requires a session');
    return;
  }
  const firstCase = page.locator('.rail-item a').first();
  if ((await firstCase.count()) === 0) {
    test.skip(true, 'no investigation rows available');
    return;
  }
  await firstCase.click();
  await page.waitForURL(/admin\/investigations\/[^/]+/);
  const dom = await page.locator('main').innerText();
  expect(dom).not.toMatch(/\bHTTP\b/);
  expect(dom).not.toMatch(/\bhttp_\d{3}\b/);
  expect(dom).not.toMatch(/\b(error|failed|invalid|timeout)\b/i);
});

/**
 * T152 — the detail page renders exactly zero or one next-step banner.
 */
test('T152 detail page never renders more than one next-step banner', async ({ page }) => {
  const response = await page.goto('/admin/investigations');
  if (
    response
    && (response.status() === 302
      || response.status() === 401
      || response.url().includes('/admin/login'))
  ) {
    test.skip(true, 'admin investigations requires a session');
    return;
  }
  const firstCase = page.locator('.rail-item a').first();
  if ((await firstCase.count()) === 0) {
    test.skip(true, 'no investigation rows available');
    return;
  }
  await firstCase.click();
  await page.waitForURL(/admin\/investigations\/[^/]+/);
  const bannerCount = await page.locator('.next-step-banner').count();
  expect(bannerCount).toBeLessThanOrEqual(1);
});
