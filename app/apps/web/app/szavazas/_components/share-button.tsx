'use client';

import { useState } from 'react';

/**
 * Megosztás — natív share sheet-tel (mobilon ez a gyakori), vágólap-
 * fallback-kel desktopon vagy ha a böngésző nem támogatja a Web Share API-t.
 */
export function ShareButton({
  url,
  title,
  text,
  label = 'Megosztás',
  className = 'poll-share-button',
}: {
  url: string;
  title: string;
  text: string;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');

  // Legacy fallback, ha a modern Clipboard API nem elérhető (pl. nem-https
  // eredetről tesztelve) — egy láthatatlan textareába másolt szöveget
  // execCommand('copy')-val másol. Deprecated API, de szélesebb körben
  // működik, mint a Clipboard API, aminek biztonságos kontextus kell.
  const legacyCopy = (value: string): boolean => {
    try {
      const el = document.createElement('textarea');
      el.value = value;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // a felhasználó megszakította, vagy nem támogatott — vágólap-fallback
      }
    }
    const combined = `${text}\n${url}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(combined);
        setStatus('copied');
        setTimeout(() => setStatus('idle'), 2500);
        return;
      } catch {
        // pl. nem-biztonságos (http) kontextus — essünk vissza a legacy útra
      }
    }
    if (legacyCopy(combined)) {
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 2500);
      return;
    }
    // Semelyik másolási mód nem elérhető — mutassuk meg a linket kézi
    // kijelöléshez/másoláshoz, ne tűnjön úgy, hogy a gomb nem csinál semmit.
    setStatus('manual');
  };

  return (
    <div className="poll-share-wrap">
      <button type="button" className={className} onClick={handleShare}>
        {status === 'copied' ? 'Vágólapra másolva!' : label}
      </button>
      {status === 'manual' && (
        <p className="poll-share-manual">
          A megosztás nem sikerült automatikusan — másold ki kézzel: <br />
          <span className="poll-share-manual-url">{url}</span>
        </p>
      )}
    </div>
  );
}
