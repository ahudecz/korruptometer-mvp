'use client';

import { useState } from 'react';

/**
 * Rács-nézetben (több videó egyszerre) NEM élő iframe alapértelmezetten —
 * ellentétben az egyedi hero-embedekkel (ugyek/[id], adatbazis/[id],
 * big-cases-section.tsx), ahol 1-3 videó fut egyszerre, itt 6 egyidejű
 * YouTube-iframe komoly teljesítményterhelés lenne betöltéskor. Helyette
 * thumbnail + play-gomb, ami kattintásra cseréli élő iframe-re.
 */
export function PodcastVideoCard({
  videoId,
  title,
  channelName,
  publishedAtLabel,
  variant,
}: {
  videoId: string;
  title: string;
  channelName: string;
  publishedAtLabel: string;
  variant?: 'hero' | 'companion';
}) {
  const [playing, setPlaying] = useState(false);

  // "podcast-" előtag a variant-osztályokon is: puszta "hero"/"companion"
  // néven már van sitewide CSS-szabály (.hero = a nyitó szekció), aminek a
  // padding/margin szabályai beleöröklődtek volna ebbe a kártyába is
  // (2026-07-15, videók teteje nem volt egyvonalban emiatt).
  return (
    <div className={variant ? `podcast-card podcast-${variant}` : 'podcast-card'}>
      <div className="podcast-video-wrap">
        {playing ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="podcast-play-overlay"
            onClick={() => setPlaying(true)}
            aria-label={`Lejátszás: ${title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- deterministic YouTube thumbnail CDN URL, nem kell Next Image-optimalizálás */}
            <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" className="podcast-thumb" loading="lazy" />
            <span className="podcast-play-icon">▶</span>
          </button>
        )}
      </div>
      <div className="podcast-meta">
        <span className="podcast-channel">{channelName}</span>
        <span className="podcast-time">{publishedAtLabel}</span>
      </div>
      <h3 className="podcast-title">{title}</h3>
    </div>
  );
}
