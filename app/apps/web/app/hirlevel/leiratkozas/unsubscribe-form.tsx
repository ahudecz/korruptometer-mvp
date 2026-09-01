'use client';

import { useState } from 'react';

/**
 * 012-reader-subscriptions FR-034, FR-035 — a leiratkozó űrlap.
 *
 * A tokent a böngésző olvassa ki, ugyanazon okból, mint a megerősítésnél. Egy
 * GET SOHA nem iratkoztat le: az RFC 8058 csak a `List-Unsubscribe-Post`
 * fejléc URL-jét védi, a levéltörzs linkjét nem, és a vállalati levélszűrők
 * azt is lekérik.
 */
export function UnsubscribeForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const token =
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('t');
    try {
      const res = await fetch('/api/hirlevel/leiratkozas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ t: token }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setMessage(data?.message ?? 'Leiratkoztál. Bármikor visszatérhetsz.');
    } catch {
      setMessage('Most nem sikerült. Próbáld újra később.');
    } finally {
      setBusy(false);
    }
  }

  if (message) {
    return <p role="status" aria-live="polite">{message}</p>;
  }

  return (
    <form onSubmit={submit}>
      <button className="newsletter-cta-btn" type="submit" disabled={busy}>
        {busy ? 'Küldés…' : 'Leiratkozom'}
      </button>
    </form>
  );
}
