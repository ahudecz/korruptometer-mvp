'use client';

import { useState } from 'react';

/**
 * A kattintásra-iframe logika kiszervezve a PodcastVideoCard/PodcastFeatureFull
 * között — mindkettő ugyanazt a thumbnail+play-gomb → élő embed viselkedést
 * akarja, csak eltérő wrapper-osztállyal (arány, méret) a body CSS-ben.
 *
 * A PodcastSpotlight NEM ezt használja, mert ott a "Megnézem" CTA a
 * szöveg-oszlopban UGYANAZT az állapotot kell vezérelje, mint a
 * thumbnail — l. usePodcastPlayback() lentebb, amit a Spotlight saját maga
 * hív meg, hogy a play-állapot közös legyen a thumb és a CTA között.
 */
export function usePodcastPlayback() {
  const [playing, setPlaying] = useState(false);
  return { playing, play: () => setPlaying(true) };
}

export function PodcastVideoBoxControlled({
  videoId,
  title,
  wrapClassName,
  playing,
  onPlay,
}: {
  videoId: string;
  title: string;
  wrapClassName: string;
  playing: boolean;
  onPlay: () => void;
}) {
  return (
    <div className={wrapClassName}>
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
          onClick={onPlay}
          aria-label={`Lejátszás: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- deterministic YouTube thumbnail CDN URL, nem kell Next Image-optimalizálás */}
          <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" className="podcast-thumb" loading="lazy" />
          <span className="podcast-play-icon">▶</span>
        </button>
      )}
    </div>
  );
}

export function PodcastVideoBox({
  videoId,
  title,
  wrapClassName,
}: {
  videoId: string;
  title: string;
  wrapClassName: string;
}) {
  const { playing, play } = usePodcastPlayback();
  return (
    <PodcastVideoBoxControlled
      videoId={videoId}
      title={title}
      wrapClassName={wrapClassName}
      playing={playing}
      onPlay={play}
    />
  );
}
