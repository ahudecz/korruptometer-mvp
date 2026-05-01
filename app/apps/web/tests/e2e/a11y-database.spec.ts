import { test } from '@playwright/test';
import { axe, expectNoSerious } from './axe-config';

/**
 * T031 — `/adatbazis` and `/adatbazis/[id]` must have zero serious/critical
 * axe violations (FR-022, SC-004).
 */
test('/adatbazis is axe-clean', async ({ page }) => {
  await page.goto('/adatbazis');
  const results = await axe(page).analyze();
  expectNoSerious(results);
});

test('/adatbazis/[id] is axe-clean', async ({ page }) => {
  await page.goto('/adatbazis');
  const link = page.locator('a[href^="/adatbazis/"]').first();
  if ((await link.count()) === 0) {
    test.skip(true, 'no seeded cases in this environment');
    return;
  }
  const href = await link.getAttribute('href');
  await page.goto(href!);
  const results = await axe(page).analyze();
  expectNoSerious(results);
});
