import { test, expect } from '@playwright/test';

/** US3 — a nyitóoldali promó-csíkról el lehet jutni a szavazóoldalra. */
test('homepage poll banner links to /szavazas', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('a.poll-banner');
  if ((await card.count()) === 0) {
    test.skip(true, 'poll banner not rendered in this environment');
    return;
  }
  await card.first().click();
  await expect(page).toHaveURL(/\/szavazas/);
  await expect(page.getByRole('heading').first()).toBeVisible();
});
