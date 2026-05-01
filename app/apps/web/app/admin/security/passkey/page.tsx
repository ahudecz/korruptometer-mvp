'use client';

import { useEffect, useState } from 'react';

/**
 * T070 — first-login passkey enrolment + step-up assertion UI. Live
 * `navigator.credentials.create` / `.get` integration with SimpleWebAuthn
 * lives behind the Phase-2 launch gates; this page does the minimal
 * happy-path flow so admins can register a credential from their device.
 */
export default function PasskeyPage() {
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!('credentials' in navigator)) {
      setStatus('Ez a böngésző nem támogatja a WebAuthn / passkey API-t.');
    }
  }, []);

  async function enrol() {
    setBusy(true);
    setStatus('Eszközválasztás folyamatban…');
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: 'Korruptométer',
            id: window.location.hostname,
          },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: 'admin',
            displayName: 'admin',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
          attestation: 'none',
          timeout: 60_000,
        },
      });
      if (!credential || credential.type !== 'public-key') {
        setStatus('Sikertelen enrolment.');
        return;
      }
      const cred = credential as PublicKeyCredential;
      const credentialId = btoa(
        String.fromCharCode(...new Uint8Array((cred as PublicKeyCredential).rawId)),
      );
      const res = await fetch('/api/admin/webauthn/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          credentialId,
          publicKey: credentialId, // Phase-2 placeholder; SimpleWebAuthn integration extracts real publicKey
        }),
      });
      if (!res.ok) {
        setStatus('Mentés sikertelen.');
        return;
      }
      setStatus('Passkey regisztrálva ✓');
    } catch (e) {
      setStatus(`Hiba: ${e instanceof Error ? e.message : 'ismeretlen'}`);
    } finally {
      setBusy(false);
    }
  }

  async function stepUp() {
    setBusy(true);
    setStatus('Step-up assertion folyamatban…');
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          userVerification: 'required',
          rpId: window.location.hostname,
          timeout: 60_000,
        },
      });
      if (!assertion) {
        setStatus('Sikertelen assertion.');
        return;
      }
      const a = assertion as PublicKeyCredential;
      const credentialId = btoa(String.fromCharCode(...new Uint8Array(a.rawId)));
      const sig = btoa(
        String.fromCharCode(
          ...new Uint8Array((a.response as AuthenticatorAssertionResponse).signature),
        ),
      );
      const res = await fetch('/api/admin/webauthn/assert', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credentialId, signature: sig }),
      });
      if (!res.ok) {
        setStatus('Step-up elutasítva.');
        return;
      }
      setStatus('Step-up sikeres — 30 perces ablak ✓');
    } catch (e) {
      setStatus(`Hiba: ${e instanceof Error ? e.message : 'ismeretlen'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" style={{ maxWidth: 600 }}>
      <h2>Passkey beállítása</h2>
      <p className="lede">
        Admin szerepkörhöz friss WebAuthn-assertion szükséges. Itt regisztrálsz
        egy új passkey-t, illetve futtatsz egy step-up assertion-t a 30 perces
        ablak frissítéséhez (FR-041).
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <button className="btn" disabled={busy} onClick={enrol}>
          Új passkey regisztrálása
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={stepUp}>
          Step-up assertion
        </button>
      </div>
      {status && (
        <p style={{ marginTop: 16, color: 'var(--muted)' }} role="status">
          {status}
        </p>
      )}
    </section>
  );
}
