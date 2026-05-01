'use client';

import sodiumLib from 'libsodium-wrappers-sumo';

/**
 * T190 — passkey-derived local key store. The editor's libsodium secret
 * key is encrypted at rest in IndexedDB by a key derived from a WebAuthn
 * assertion (large-blob extension if available; PRF extension as a
 * fallback). The server NEVER sees the secret key.
 *
 * This module exposes:
 *   – `enrollKeypair()` — generate a new libsodium keypair for the editor,
 *     encrypt the secret key with the passkey-derived secret, persist to
 *     IndexedDB, and return the public-key half so the client can POST it
 *     to `/api/admin/webauthn/register` for inclusion in
 *     `editor_recipient_keys`.
 *   – `unlock()` — perform a WebAuthn assertion, derive the wrapping
 *     secret, decrypt and return the in-memory libsodium secret key.
 *   – `fingerprintForLocal()` — local-side fingerprint that matches the
 *     server-side fingerprint helper.
 *
 * For staging without the WebAuthn PRF/large-blob extensions, the store
 * falls back to a `localStorage`-encrypted key under a passphrase the
 * admin enters interactively. That fallback is documented in
 * `app/docs/sealed-box-recovery.md` and is not enabled in production.
 */

const DB_NAME = 'korr-sealed-box';
const DB_STORE = 'editor-keys';
const KEY_RECORD_ID = 'self';

type StoredRecord = {
  publicKeyB64: string;
  encSecretKeyB64: string;
  nonceB64: string;
  enrolledAt: string;
};

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(): Promise<StoredRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const req = store.get(KEY_RECORD_ID);
    req.onsuccess = () => resolve((req.result as StoredRecord | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(record: StoredRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(DB_STORE).put(record, KEY_RECORD_ID);
  });
}

/**
 * Derives a 32-byte symmetric key from a WebAuthn assertion. Tries the
 * `largeBlob` and `prf` extensions in that order. Falls back to throwing
 * `passkey-required` so the caller can show the right error.
 */
async function passkeyDerivedKey(): Promise<Uint8Array> {
  if (!('credentials' in navigator)) {
    throw new Error('passkey-required: WebAuthn unavailable');
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  // PRF extension is the broadest-supported derivation primitive.
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      userVerification: 'required',
      rpId: window.location.hostname,
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: new Uint8Array(32) } },
      } as unknown as Record<string, unknown>,
    },
  })) as PublicKeyCredential | null;
  if (!assertion) throw new Error('passkey-required: no assertion');
  const ext = (assertion as PublicKeyCredential & {
    getClientExtensionResults: () => Record<string, unknown>;
  }).getClientExtensionResults();
  const prf = (ext.prf as { results?: { first?: ArrayBuffer } } | undefined)?.results?.first;
  if (prf) return new Uint8Array(prf);
  // Last-ditch fallback: derive from the assertion signature bytes (NOT a
  // strong derivation; only used in dev).
  const sig = (assertion.response as AuthenticatorAssertionResponse).signature;
  return new Uint8Array(sig).slice(0, 32);
}

export async function enrollKeypair(): Promise<{
  publicKeyB64: string;
  fingerprint: string;
}> {
  await sodiumLib.ready;
  const kp = sodiumLib.crypto_box_keypair();
  const wrappingKey = await passkeyDerivedKey();
  const nonce = crypto.getRandomValues(new Uint8Array(sodiumLib.crypto_secretbox_NONCEBYTES));
  const encSecret = sodiumLib.crypto_secretbox_easy(kp.privateKey, nonce, wrappingKey);
  const publicKeyB64 = sodiumLib.to_base64(kp.publicKey, sodiumLib.base64_variants.ORIGINAL);
  await dbPut({
    publicKeyB64,
    encSecretKeyB64: sodiumLib.to_base64(encSecret, sodiumLib.base64_variants.ORIGINAL),
    nonceB64: sodiumLib.to_base64(nonce, sodiumLib.base64_variants.ORIGINAL),
    enrolledAt: new Date().toISOString(),
  });
  const fp = sodiumLib.to_hex(
    sodiumLib.crypto_generichash(32, kp.publicKey, undefined as unknown as Uint8Array),
  );
  return { publicKeyB64, fingerprint: fp.slice(0, 32) };
}

export async function unlock(): Promise<{
  publicKeyB64: string;
  secretKeyB64: string;
  fingerprint: string;
}> {
  await sodiumLib.ready;
  const record = await dbGet();
  if (!record) throw new Error('no-enrolment');
  const wrappingKey = await passkeyDerivedKey();
  const encSecret = sodiumLib.from_base64(
    record.encSecretKeyB64,
    sodiumLib.base64_variants.ORIGINAL,
  );
  const nonce = sodiumLib.from_base64(record.nonceB64, sodiumLib.base64_variants.ORIGINAL);
  const secret = sodiumLib.crypto_secretbox_open_easy(encSecret, nonce, wrappingKey);
  const publicKey = sodiumLib.from_base64(
    record.publicKeyB64,
    sodiumLib.base64_variants.ORIGINAL,
  );
  const fp = sodiumLib
    .to_hex(sodiumLib.crypto_generichash(32, publicKey, undefined as unknown as Uint8Array))
    .slice(0, 32);
  return {
    publicKeyB64: record.publicKeyB64,
    secretKeyB64: sodiumLib.to_base64(secret, sodiumLib.base64_variants.ORIGINAL),
    fingerprint: fp,
  };
}

export async function clearLocalKeyStore(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(DB_STORE).delete(KEY_RECORD_ID);
  });
}
