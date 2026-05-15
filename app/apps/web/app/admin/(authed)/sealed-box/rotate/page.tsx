'use client';

import Link from 'next/link';
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
  const [status, setStatus] = useState<{ kind: 'idle' | 'pending' | 'ok' | 'error'; msg: string }>(
    { kind: 'idle', msg: '' },
  );
  const [busy, setBusy] = useState(false);

  async function trigger() {
    setBusy(true);
    setStatus({ kind: 'pending', msg: 'Rotation eseményt küldés…' });
    try {
      const res = await fetch('/api/admin/sealed-box/rotate', { method: 'POST' });
      if (!res.ok) {
        setStatus({ kind: 'error', msg: 'Hiba — admin step-up szükséges?' });
        return;
      }
      setStatus({ kind: 'ok', msg: 'Rotation event eljutott az Inngestbe.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">
            <Link href="/admin" style={{ color: 'inherit' }}>
              ← Vissza a sorhoz
            </Link>
            {'  ·  '}Sealed-box karbantartás
          </div>
          <h1 className="admin-title">Recipient rotation</h1>
          <p className="admin-sub">
            Új vagy visszavont szerkesztői kulcs után minden bejelentés
            ciphertextjét a friss recipientlistára kell újraérvényesíteni
            (<strong>FR-081</strong>). Az újratitkosítás a résztvevő szerkesztők
            böngészőjében történik — a szerver csak a folyamatot indítja és a
            haladást rögzíti.
          </p>
        </div>
      </header>

      <section className="detail-section" style={{ padding: '28px 0', borderBottom: 0 }}>
        <h4>Indítás</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="dbtn primary"
            style={{ background: 'var(--ink)', color: '#fff' }}
            disabled={busy}
            onClick={trigger}
          >
            {busy ? 'Indítás…' : 'Rotation indítása'}
          </button>
          {status.kind !== 'idle' && (
            <span
              className={`state-badge ${
                status.kind === 'ok' ? 'approved' : status.kind === 'error' ? 'rejected' : 'pending'
              }`}
              role="status"
            >
              <span className="dot" />
              {status.msg}
            </span>
          )}
        </div>
      </section>

      <section className="detail-section" style={{ padding: '0 0 60px', borderBottom: 0 }}>
        <h4>Hogyan működik</h4>
        <ol style={{ paddingLeft: 24, lineHeight: 1.7, fontSize: 14, maxWidth: 720 }}>
          <li>
            Az adminok eszközein passkey-vel kinyitott libsodium kulcs szükséges
            minden olyan rekordhoz, amit újra kell zárni.
          </li>
          <li>
            Az új <code>EditorKey</code> sorokat előbb regisztrálni kell a{' '}
            <code>/admin/security/passkey</code> oldalon.
          </li>
          <li>
            A rotation kvóta-tudatos — egy ezer-rekordos szerkesztői csere sem
            üti agyon a queue-t (Inngest concurrency 1).
          </li>
          <li>
            Megszakított futás újraindítása idempotens; a befejezett sorokat nem
            nyitja fel újra.
          </li>
        </ol>
      </section>
    </>
  );
}
