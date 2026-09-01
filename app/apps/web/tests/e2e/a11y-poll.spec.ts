import { test } from '@playwright/test';
import { axe, expectNoSerious } from './axe-config';

/** /szavazas must have zero serious/critical axe violations (Constitution "Additional Standards"). */
test('/szavazas is axe-clean', async ({ page }) => {
  await page.goto('/szavazas');
  const results = await axe(page).analyze();
  expectNoSerious(results);
});
