'use client';

import { useState } from 'react';

import { facebookEmbedUrl } from '@korr/shared/facebook-reel';

/**
 * Facebook reel beágyazott lejátszó, KÉT KATTINTÁSSAL.
 *
 * Első állapot: a saját Storage-unkban lévő poszterkép + play gomb — ez
 * statikus kép, a Facebook felé nulla kérés megy. Csak kattintásra jön létre
 * az iframe, onnantól a Facebook saját lejátszója fut benne.
 *
 * Miért így: (1) a látogató a saját döntéséig nem kap Facebook-sütit, ami
 * konzisztens a cookie-bannerünkkel; (2) egy rács tele automatikusan betöltő
 * facebook.com iframe-mel érezhetően lassabb oldalt adna.
 *
 * A CSP `frame-src`-ja a www.facebook.com origint engedi (next.config.js);
 * az URL-validálás a `facebookEmbedUrl()`-ben van (@korr/shared).
 */
export function FbReelEmbed({
  url,
  posterUrl,
  authorName,
  variant = 'default',
}: {
  url: string;
  posterUrl?: string | null;
  authorName?: string | null;
  variant?: 'default' | 'hero';
}) {
  const [playing, setPlaying] = useState(false);
  const embedUrl = facebookEmbedUrl(url);
  if (!embedUrl) return null;

  const label = authorName ? `Reel lejátszása — ${authorName}` : 'Reel lejátszása';

  return (
    <div className={`fb-reel${variant === 'hero' ? ' fb-reel--hero' : ''}`}>
      {playing ? (
        <iframe
          src={embedUrl}
          title={label}
          className="fb-reel-frame"
          scrolling="no"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button type="button" className="fb-reel-poster" onClick={() => setPlaying(true)} aria-label={label}>
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterUrl} alt="" loading="lazy" />
          ) : (
            // Poszterkép nélküli reel (a Facebook-szinkron nem mindig ad
            // thumbnailt). Ilyenkor sem fekete dobozt mutatunk: a szerző
            // neve + "Reel" felirat is elmondja, mire kattint a látogató.
            <span className="fb-reel-poster-empty" aria-hidden="true">
              {authorName && <span className="fb-reel-poster-empty-author">{authorName}</span>}
              <span className="fb-reel-poster-empty-label">Reel</span>
            </span>
          )}
          <span className="fb-reel-play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" focusable="false">
              <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
