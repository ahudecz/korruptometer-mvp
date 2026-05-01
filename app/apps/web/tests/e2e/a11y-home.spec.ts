import { test } from '@playwright/test';
import { axe, expectNoSerious } from './axe-config';

/** T038 — / must have zero serious/critical axe violations (FR-022, SC-004). */
test('/ is axe-clean', async ({ page }) => {
  await page.goto('/');
  const results = await axe(page).analyze();
  expectNoSerious(results);
});
