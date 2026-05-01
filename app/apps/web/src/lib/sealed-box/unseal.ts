'use client';

import sodiumLib from 'libsodium-wrappers-sumo';

import type { SealedEnvelope } from './seal';
export { hasActiveRecipient, resolveRecipient } from './recipient-resolution';

/**
 * T189 — client-side `unseal`. The editor's browser holds the libsodium
 * keypair (encrypted at rest in IndexedDB by a passkey-derived secret;
 * see `key-store.ts`). The server NEVER sees the secret key.
 *
 * Returns the plaintext string for the caller's recipient slot, or throws
 * if the envelope doesn't address this editor.
 */
export async function unseal(
  envelope: SealedEnvelope,
  args: { mySecretKeyB64: string; myPublicKeyB64: string; myFingerprint: string },
): Promise<string> {
  await sodiumLib.ready;
  const mine = envelope.recipients.find((r) => r.fingerprint === args.myFingerprint);
  if (!mine) {
    throw new Error('orphan-recipient');
  }
  const ct = sodiumLib.from_base64(mine.ciphertextB64, sodiumLib.base64_variants.ORIGINAL);
  const sk = sodiumLib.from_base64(args.mySecretKeyB64, sodiumLib.base64_variants.ORIGINAL);
  const pk = sodiumLib.from_base64(args.myPublicKeyB64, sodiumLib.base64_variants.ORIGINAL);
  const plaintext = sodiumLib.crypto_box_seal_open(ct, pk, sk);
  return sodiumLib.to_string(plaintext);
}

/**
 * Returns true if any of the envelope's recipient fingerprints is in the
 * provided active-recipient list. The queue UI uses this to render the
 * `orphan-recipient` cell when the answer is false (T204 / T205, SC-033).
 *
 * Re-exported from `./recipient-resolution.ts` so the test surface doesn't
 * need to load libsodium.
 */
export function hasActiveRecipientFromEnvelope(
  envelope: SealedEnvelope,
  activeFingerprints: Set<string>,
): boolean {
  return envelope.recipients.some((r) => activeFingerprints.has(r.fingerprint));
}
