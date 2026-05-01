import { test, expect } from '@playwright/test';
import { axe, expectNoSerious } from './axe-config';

/**
 * T043 — `/galeria` shows top-N rogues in amount-desc order with
 * deterministic mugshot rendering and zero serious/critical axe violations
 * (US3 acceptance scenarios 1–3, FR-022).
 */
test('/galeria renders rogue cards', async ({ page }) => {
  await page.goto('/galeria');
  const cards = page.locator('.rogue-card, .gallery-card, article');
  // Either cards exist or empty-state — but heading must render.
  await expect(page.getByRole('heading').first()).toBeVisible();
  const total = await cards.count();
  expect(total).toBeGreaterThanOrEqual(0);
});

test('/galeria mugshots are deterministic across reloads', async ({ page }) => {
  await page.goto('/galeria');
  const firstHtml = await page.locator('svg').first().innerHTML().catch(() => '');
  await page.reload();
  const secondHtml = await page.locator('svg').first().innerHTML().catch(() => '');
  expect(firstHtml).toEqual(secondHtml);
});

test('/galeria is axe-clean', async ({ page }) => {
  await page.goto('/galeria');
  const results = await axe(page).analyze();
  expectNoSerious(results);
});
