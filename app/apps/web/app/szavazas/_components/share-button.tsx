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
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // a felhasználó megszakította, vagy nem támogatott — vágólap-fallback
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // semmit nem tehetünk — a gomb legalább nem dob hibát a felhasználónak
    }
  };

  return (
    <button type="button" className={className} onClick={handleShare}>
      {copied ? 'Vágólapra másolva!' : label}
    </button>
  );
}
