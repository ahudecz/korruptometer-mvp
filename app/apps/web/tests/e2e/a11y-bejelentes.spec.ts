import { test } from '@playwright/test';
import { axe, expectNoSerious } from './axe-config';

/** T088 — `/bejelentes` axe-clean (FR-022, SC-004). */
test('/bejelentes is axe-clean', async ({ page }) => {
  await page.goto('/bejelentes');
  const results = await axe(page).analyze();
  expectNoSerious(results);
});
