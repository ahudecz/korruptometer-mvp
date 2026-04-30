/**
 * Symmetric PII encryption helpers used by the Phase-2 admin queue.
 * Uses Node's built-in AES-256-GCM with a key derived from PII_ENC_KEY.
 *
 * IMPORTANT (FR-058 / docs/pii-threat-model.md): this control defends against
 * offline backup-tape leaks where the key is held separately. It does NOT
 * defend against an attacker with app-server access, because every render
 * needs the key in memory. Phase 4 sealed-box is the durable answer.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function key(): Buffer {
  const raw = process.env.PII_ENC_KEY;
  if (!raw) throw new Error('PII_ENC_KEY is not set');
  // Derive a 32-byte key from the configured value. Production deployments
  // should set a 32-byte base64 key; for dev we hash to 32 bytes.
  return createHash('sha256').update(raw).digest();
}

export function encryptPii(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptPii(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
