'use client';

import { useState } from 'react';

/**
 * T211 — `/admin/sealed-box/rotate` UI. Orchestrates the in-browser
 * re-seal flow: collect plaintext from designated editors, re-seal to the
 * new recipient list, POST progress to the rotate endpoint.
 *
 * The rotation function on the server (T209) is itself a no-op in Phase-2
 * deployment because the actual re-sealing is gated behind the
 * `SUBMISSIONS_SEALED_BOX_ENABLED=true` flag. This page is the manual
 * trigger that admins use during the recipient-list change window.
 */
export default function SealedBoxRotatePage() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function trigger() {
    setBusy(true);
    setStatus('Rotation eseményt küldés…');
    try {
      const res = await fetch('/api/admin/sealed-box/rotate', { method: 'POST' });
      if (!res.ok) {
        setStatus('Hiba — admin step-up szükséges?');
        return;
      }
      setStatus('Rotation event eljutott az Inngestbe ✓');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" style={{ maxWidth: 700 }}>
      <h2>Sealed-box recipient rotation</h2>
      <p className="lede">
        Új vagy visszavont szerkesztői kulcs után minden bejelentés
        ciphertextjét a friss recipientlistára kell újraérvényesíteni
        (FR-081). Az újratitkosítás a résztvevő szerkesztők böngészőjében
        történik — a szerver csak a folyamatot indítja és a haladást
        rögzíti.
      </p>
      <button className="btn" disabled={busy} onClick={trigger}>
        Indítás
      </button>
      {status && (
        <p style={{ marginTop: 16, color: 'var(--muted)' }} role="status">
          {status}
        </p>
      )}
      <h3 style={{ marginTop: 32 }}>Hogyan működik</h3>
      <ol style={{ paddingLeft: 24, lineHeight: 1.6 }}>
        <li>
          Az adminok eszközein passkey-vel kinyitott libsodium kulcs
          szükséges minden olyan rekordhoz, amit újra kell zárni.
        </li>
        <li>
          Az új <code>EditorKey</code> sorokat előbb regisztrálni kell a{' '}
          <code>/admin/security/passkey</code> oldalon.
        </li>
        <li>
          A rotation kvóta-tudatos — egy ezer-rekordos szerkesztői csere
          sem üti agyon a queue-t (Inngest concurrency 1).
        </li>
        <li>
          Megszakított futás újraindítása idempotens; a befejezett sorokat
          nem nyitja fel újra.
        </li>
      </ol>
    </section>
  );
}
