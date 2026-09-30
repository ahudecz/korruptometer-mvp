'use client';

import { useState } from 'react';

import { facebookPostEmbedUrl } from '@korr/shared/facebook-reel';

/**
 * Facebook SZÖVEGES poszt beágyazása, kattintásra betöltődve — ugyanaz a
 * minta, mint az FbReelEmbed-nél: amíg a látogató nem kattint, a Facebook
 * felé nulla kérés megy (nincs FB-süti, nincs lassító iframe), addig a saját
 * kártyánk látszik a szerzővel, a dátummal és egy rövid idézettel.
 *
 * A CSP `frame-src`-ja a www.facebook.com origint már engedi (next.config.js);
 * az URL-validálás a `facebookPostEmbedUrl()`-ben van (@korr/shared).
 */
export function FbPostEmbed({
  url,
  authorName,
  date,
  excerpt,
}: {
  url: string;
  authorName: string;
  date?: string;
  excerpt?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const embedUrl = facebookPostEmbedUrl(url);
  if (!embedUrl) return null;

  return (
    <div className="fb-post">
      {loaded ? (
        <iframe
          src={embedUrl}
          title={`${authorName} Facebook-bejegyzése`}
          className="fb-post-frame"
          frameBorder="0"
          allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
        />
      ) : (
        <div className="fb-post-card">
          <div className="fb-post-meta">
            <span className="fb-post-author">{authorName}</span>
            {date && <span className="fb-post-date">{date} · Facebook</span>}
          </div>
          {excerpt && <p className="fb-post-excerpt">„{excerpt}”</p>}
          <div className="fb-post-actions">
            <button type="button" className="fb-post-load" onClick={() => setLoaded(true)}>
              Bejegyzés betöltése
            </button>
            <a className="fb-post-link" href={url} target="_blank" rel="noopener noreferrer">
              Megnyitás a Facebookon →
            </a>
          </div>
          <p className="fb-post-note">A betöltéssel a Facebook tartalma jelenik meg, és a Facebook sütiket helyezhet el.</p>
        </div>
      )}
    </div>
  );
}
