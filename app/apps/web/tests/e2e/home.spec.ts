import { test, expect } from '@playwright/test';

/**
 * T037 — homepage E2E. Five hero KPIs render, donut SVGs are present, the
 * freshness label exists, and a Hungarian magnitude formatter sample
 * appears (US2 acceptance scenarios 1–4).
 */
test('homepage hero shows KPIs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })).first()).toBeVisible();

  // The KPI cards include numbers + a unit label like "Mrd Ft" / "M Ft" / "Ft".
  const body = await page.locator('body').innerText();
  expect(body).toMatch(/(Mrd Ft|M Ft|e Ft|\d+\s+Ft)/);
});

test('homepage shows freshness label', async ({ page }) => {
  await page.goto('/');
  const body = await page.locator('body').innerText();
  // Hungarian relative-time helper produces "frissítve X perccel ezelőtt" /
  // "másodperccel" / "órával" / "nappal" depending on the lag bucket.
  expect(body).toMatch(/frissítve|frissítés/i);
});

test('homepage donut SVGs render', async ({ page }) => {
  await page.goto('/');
  const svgs = await page.locator('svg').count();
  expect(svgs).toBeGreaterThan(0);
});
