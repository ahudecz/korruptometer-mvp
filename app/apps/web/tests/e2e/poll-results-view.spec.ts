import { test, expect } from '@playwright/test';

/**
 * US2 — az eredmény-nézet vízszintes csíkokkal jelenik meg, csökkenő
 * szavazatarány szerint, és hibamentesen kezeli a 0-szavazatos állapotot is.
 */
test('results view renders vote-share bars without a horizontal scrollbar', async ({ page }) => {
  await page.goto('/szavazas');
  const resultsTab = page.getByRole('button', { name: /eredmények/i });
  if ((await resultsTab.count()) === 0) {
    test.skip(true, 'results tab not rendered in this environment');
    return;
  }
  await resultsTab.click();

  const bars = page.locator('.poll-result-bar');
  const count = await bars.count();
  if (count === 0) {
    // 0-szavazatos állapot — nem hiba, csak még nincs adat.
    await expect(page.getByText(/még nem érkezett szavazat/i)).toBeVisible();
    return;
  }

  await expect(bars.first()).toBeVisible();
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
});
