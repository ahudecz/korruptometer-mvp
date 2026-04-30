'use client';

import sodiumLib from 'libsodium-wrappers-sumo';

/**
 * 16-byte (32 hex chars) fingerprint of an editor public key.
 * Same algo as packages/shared/sealed-box.ts so client and server agree.
 */
export async function fingerprint(publicKeyB64: string): Promise<string> {
  await sodiumLib.ready;
  const publicKey = sodiumLib.from_base64(publicKeyB64, sodiumLib.base64_variants.ORIGINAL);
  const hashed = sodiumLib.crypto_generichash(32, publicKey, undefined as unknown as Uint8Array);
  return sodiumLib.to_hex(hashed as Uint8Array).slice(0, 32);
}
