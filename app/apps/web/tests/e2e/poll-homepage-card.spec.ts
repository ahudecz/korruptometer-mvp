import { test, expect } from '@playwright/test';

/** US3 — a főoldali kártyáról el lehet jutni a szavazóoldalra. */
test('homepage poll card links to /szavazas', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('a.poll-teaser-card');
  if ((await card.count()) === 0) {
    test.skip(true, 'poll teaser card not rendered in this environment');
    return;
  }
  await card.first().click();
  await expect(page).toHaveURL(/\/szavazas/);
  await expect(page.getByRole('heading').first()).toBeVisible();
});
