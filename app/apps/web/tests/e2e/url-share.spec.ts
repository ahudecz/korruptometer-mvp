import { test, expect } from '@playwright/test';

/**
 * T056 — URL state is the single source of truth. Open a generated filtered
 * URL in a fresh browser context and assert an identical view on first
 * load (SC-007).
 */
test('filtered /adatbazis URL is bit-for-bit reproducible across contexts', async ({ browser }) => {
  const url = '/adatbazis?sort=amount_desc&sector=K%C3%B6zbeszerz%C3%A9s';

  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await p1.goto(url);
  const main1 = await p1.locator('main').innerHTML();
  await ctx1.close();

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(url);
  const main2 = await p2.locator('main').innerHTML();
  await ctx2.close();

  expect(main1).toEqual(main2);
});
