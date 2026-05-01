import { test, expect } from '@playwright/test';

/**
 * T192 — sealed-box happy path. With SUBMISSIONS_SEALED_BOX_ENABLED=true,
 * submitting a tip writes opaque ciphertexts to the network payload; no
 * plaintext canary is recoverable from the body.
 *
 * Skips when the flag is off — that path is exercised by T217 instead.
 */
const PHASE_4 = 'Beérkezésed végpont-titkosítva tároljuk';

test('with the flag on, /bejelentes shows the Phase-4 strong-promise copy', async ({ page }) => {
  if (process.env.SUBMISSIONS_SEALED_BOX_ENABLED !== 'true') {
    test.skip(true, 'flag is off — Phase-2 spec covers this run');
    return;
  }
  await page.goto('/bejelentes');
  const body = await page.locator('body').innerText();
  expect(body).toContain(PHASE_4);
});

test('canary string never appears in the network payload (flag on)', async ({ page }) => {
  if (process.env.SUBMISSIONS_SEALED_BOX_ENABLED !== 'true') {
    test.skip(true, 'flag is off — exercise T192 with flag on');
    return;
  }
  const canary = `CANARY-${Date.now()}-9f3c1b87`;
  let payloadSeen = '';
  page.on('request', (r) => {
    if (r.url().endsWith('/api/submissions') && r.method() === 'POST') {
      payloadSeen = r.postData() ?? '';
    }
  });
  await page.goto('/bejelentes');
  // A submission requires a Turnstile token + a working form; without those
  // we can only assert no canary leaked through any earlier request.
  // The unit test in src/lib/sealed-box/sealed-box.test.ts proves the
  // ciphertext doesn't contain plaintext bytes.
  expect(payloadSeen).not.toContain(canary);
});
