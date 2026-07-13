'use client';
import { useEffect, useState } from 'react';
import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const CONSENT_KEY = 'kj_cookie_consent';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      setVisible(true);
    } else {
      // Google Consent Mode v2 already defaults everything to 'denied' in the
      // inline script below (fires before gtag.js loads); a returning
      // 'accepted' visitor needs an explicit 'update' call to lift that.
      updateConsent(stored === 'accepted' ? 'granted' : 'denied');
    }

    (window as any).__revokeKjConsent = () => {
      localStorage.removeItem(CONSENT_KEY);
      updateConsent('denied');
      setVisible(true);
    };
  }, []);

  function updateConsent(state: 'granted' | 'denied') {
    window.gtag?.('consent', 'update', { analytics_storage: state });
  }

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    updateConsent('granted');
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'declined');
    updateConsent('denied');
    setVisible(false);
  }

  return (
    <>
      {GA_ID && (
        <>
          {/* Consent Mode v2 — MUST run before gtag.js loads and before the
              config call below, so every hit (even a declined/denied one)
              carries a consent signal Google can use for cookieless
              modeling, instead of the script never loading at all (the old
              behavior, which sent Google zero data — including zero signal
              — whenever a visitor declined). Rendered first in this same
              'afterInteractive' group; Next.js preserves script order
              within a strategy, so this always executes before the two
              scripts after it. */}
          <Script id="ga-consent-default" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('consent', 'default', {
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              analytics_storage: 'denied',
              wait_for_update: 500
            });
          `}</Script>
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
