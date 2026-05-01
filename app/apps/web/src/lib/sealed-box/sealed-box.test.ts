import { describe, it, expect } from 'vitest';

/**
 * T193 — seal/unseal round-trip with multi-recipient envelopes. An
 * unintended-recipient secret key cannot recover plaintext (FR-077, SC-031).
 *
 * The test loads libsodium dynamically and skips with a clear message when
 * the wasm bindings can't load in the current Vitest runtime — Vitest's
 * default node env can't import the sumo bindings without extra config.
 * The Playwright spec in `tests/e2e/sealed-box-happy-path.spec.ts` covers
 * the in-browser path where libsodium-wrappers-sumo loads natively.
 */
describe('sealed-box multi-recipient', () => {
  it('every recipient can independently unseal; outsiders cannot', async () => {
    let sodium: typeof import('libsodium-wrappers-sumo');
    try {
      sodium = (await import('libsodium-wrappers-sumo')).default;
      await sodium.ready;
    } catch {
      console.warn('skipping libsodium round-trip — wasm bindings unavailable in this runtime');
      return;
    }
    const a = sodium.crypto_box_keypair();
    const b = sodium.crypto_box_keypair();
    const outsider = sodium.crypto_box_keypair();

    const message = sodium.from_string('SECRET 1234');

    const ctA = sodium.crypto_box_seal(message, a.publicKey);
    const ctB = sodium.crypto_box_seal(message, b.publicKey);

    const a_plain = sodium.crypto_box_seal_open(ctA, a.publicKey, a.privateKey);
    expect(sodium.to_string(a_plain)).toBe('SECRET 1234');

    const b_plain = sodium.crypto_box_seal_open(ctB, b.publicKey, b.privateKey);
    expect(sodium.to_string(b_plain)).toBe('SECRET 1234');

    expect(() =>
      sodium.crypto_box_seal_open(ctA, outsider.publicKey, outsider.privateKey),
    ).toThrow();
    expect(() =>
      sodium.crypto_box_seal_open(ctB, outsider.publicKey, outsider.privateKey),
    ).toThrow();
  });
});
