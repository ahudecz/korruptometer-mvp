'use client';

import { useState } from 'react';

/**
 * 012-reader-subscriptions FR-034, FR-035 — a megerősítő űrlap.
 *
 * A tokent a BÖNGÉSZŐ olvassa ki a címsorból, a beküldés pillanatában. A
 * szerver által kirajzolt HTML így semmit nem tud a tokenről, tehát egy
 * érvényes, egy lejárt és egy kitalált token oldala szó szerint azonos.
 *
 * A megjelenítés SEMMIT nem módosít. Az érvényesség kizárólag a beküldés után
 * derül ki — ezért nem lehet egy levélszűrő linkelőnézetével elégetni.
 */
type Result = { state: string; message: string; resend?: boolean };

export function ConfirmForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [resent, setResent] = useState<string | null>(null);

  function tokenFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('t');
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/hirlevel/megerosites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ t: tokenFromUrl() }),
      });
      const data = (await res.json().catch(() => null)) as Result | null;
      setResult(data ?? { state: 'expired', message: 'Ez a link lejárt.', resend: true });
    } catch {
      setResult({ state: 'expired', message: 'Ez a link lejárt.', resend: true });
    } finally {
      setBusy(false);
    }
  }

  async function requestNew() {
    setBusy(true);
    try {
      const res = await fetch('/api/hirlevel/megerosites/ujra', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ t: tokenFromUrl() }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setResent(data?.message ?? 'Elküldtük az új linket.');
    } catch {
      setResent('Most nem sikerült. Próbáld újra később.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div>
        <p role="status" aria-live="polite">{result.message}</p>
        {result.resend && !resent ? (
          <button className="newsletter-cta-btn" type="button" onClick={requestNew} disabled={busy}>
            Küldj újat
          </button>
        ) : null}
        {resent ? <p role="status" aria-live="polite">{resent}</p> : null}
        {result.state === 'erased' ? (
          <p>
            Írj nekünk: <a href="mailto:hello@kegyencjarat.hu">hello@kegyencjarat.hu</a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={confirm}>
      <button className="newsletter-cta-btn" type="submit" disabled={busy}>
        {busy ? 'Küldés…' : 'Megerősítem'}
      </button>
    </form>
  );
}
