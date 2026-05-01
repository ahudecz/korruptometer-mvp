import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * T145 — axe accessibility scan on /hirek (FR-022, SC-004). Fails on any
 * WCAG 2.1 A or AA violation in the rendered news list.
 */
test('/hirek has no detectable axe violations', async ({ page }) => {
  await page.goto('/hirek');
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
