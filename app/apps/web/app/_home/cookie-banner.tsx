'use client';
import { useEffect, useState } from 'react';
import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const CONSENT_KEY = 'kj_cookie_consent';

export function CookieBanner() {
  const [consent, setConsent] = useState<'accepted' | 'declined' | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      setVisible(true);
    } else {
      setConsent(stored as 'accepted' | 'declined');
    }

    (window as any).__revokeKjConsent = () => {
      localStorage.removeItem(CONSENT_KEY);
      setConsent(null);
      setVisible(true);
    };
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setConsent('accepted');
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setConsent('declined');
    setVisible(false);
  }

  return (
    <>
      {consent === 'accepted' && GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { anonymize_ip: true });
          `}</Script>
        </>
      )}
      {visible && (
        <div className="cookie-banner" role="dialog" aria-label="Cookie tájékoztató">
          <span className="cookie-text">
            Statisztikai célból Google Analytics-t használunk.{' '}
            <a href="/adatvedelem">Részletek</a>
          </span>
          <div className="cookie-actions">
            <button className="cookie-btn cookie-btn--decline" onClick={decline}>
              Elutasítom
            </button>
            <button className="cookie-btn cookie-btn--accept" onClick={accept}>
              Elfogadom
            </button>
          </div>
        </div>
      )}
    </>
  );
}
