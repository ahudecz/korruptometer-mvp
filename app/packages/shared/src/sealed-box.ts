/**
 * Phase 4 sealed-box primitives. The real production wiring uses
 * libsodium-wrappers in the browser and is initialised lazily — this module
 * exposes the shape (fingerprints, payload helpers) that both the client and
 * server agree on. The actual seal/unseal happens in
 * apps/web/src/lib/sealed-box/{seal,unseal}.ts.
 */

import { createHash } from 'node:crypto';

export function fingerprintFromPublicKey(publicKeyB64: string): string {
  return createHash('sha256').update(Buffer.from(publicKeyB64, 'base64')).digest('hex').slice(0, 32);
}

export type SealedBoxEnvelope = {
  ciphertext: string;
  recipientFingerprints: string[];
};
