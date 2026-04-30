'use client';

import sodiumLib from 'libsodium-wrappers-sumo';

let initPromise: Promise<typeof sodiumLib> | null = null;

async function getSodium() {
  if (!initPromise) {
    initPromise = (async () => {
      await sodiumLib.ready;
      return sodiumLib;
    })();
  }
  return initPromise;
}

/**
 * Multi-recipient sealed-box (Phase 4 / FR-077). For each recipient we
 * compute their own crypto_box_seal envelope and bundle them into a single
 * JSON payload alongside the recipient fingerprints (FR-080 / SC-033).
 *
 * The raw `crypto_box_seal` API is asymmetric (anonymous sender), so each
 * editor only needs their secret key to unseal — exactly what the spec asks.
 */
export type SealedEnvelope = {
  algo: 'libsodium-sealed-box-v1';
  recipients: { fingerprint: string; ciphertextB64: string }[];
};

export async function seal(plaintext: string, recipients: { publicKeyB64: string; fingerprint: string }[]): Promise<SealedEnvelope> {
  if (recipients.length === 0) {
    throw new Error('No recipients available — cannot seal a submission.');
  }
  const sodium = await getSodium();
  const message = sodium.from_string(plaintext);
  const items = recipients.map((r) => {
    const publicKey = sodium.from_base64(r.publicKeyB64, sodium.base64_variants.ORIGINAL);
    const ciphertext = sodium.crypto_box_seal(message, publicKey);
    return {
      fingerprint: r.fingerprint,
      ciphertextB64: sodium.to_base64(ciphertext, sodium.base64_variants.ORIGINAL),
    };
  });
  return { algo: 'libsodium-sealed-box-v1', recipients: items };
}

export async function unseal(envelope: SealedEnvelope, mySecretKeyB64: string, myPublicKeyB64: string, myFingerprint: string): Promise<string> {
  const sodium = await getSodium();
  const mine = envelope.recipients.find((r) => r.fingerprint === myFingerprint);
  if (!mine) throw new Error('Sealed envelope does not target this editor.');
  const ct = sodium.from_base64(mine.ciphertextB64, sodium.base64_variants.ORIGINAL);
  const sk = sodium.from_base64(mySecretKeyB64, sodium.base64_variants.ORIGINAL);
  const pk = sodium.from_base64(myPublicKeyB64, sodium.base64_variants.ORIGINAL);
  const decrypted = sodium.crypto_box_seal_open(ct, pk, sk);
  return sodium.to_string(decrypted);
}
