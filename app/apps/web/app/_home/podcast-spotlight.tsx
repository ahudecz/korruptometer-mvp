'use client';

import { PodcastVideoBoxControlled, usePodcastPlayback } from './podcast-video-box';

export function PodcastSpotlight({
  videoId,
  title,
  description,
  channelName,
  publishedAtLabel,
  eyebrow,
  flip,
  lead,
}: {
  videoId: string;
  title: string;
  description: string | null;
  channelName: string;
  publishedAtLabel: string;
  eyebrow: string;
  flip?: boolean;
  lead?: boolean;
}) {
  const { playing, play } = usePodcastPlayback();

  const classNames = [
    'podcast-spotlight',
    flip ? 'podcast-spotlight--flip' : '',
    lead ? 'podcast-spotlight--lead' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <div className="podcast-spotlight-media">
        <PodcastVideoBoxControlled
          videoId={videoId}
          title={title}
          wrapClassName="podcast-spotlight-video-wrap"
          playing={playing}
          onPlay={play}
        />
      </div>
      <div className="podcast-spotlight-text">
        <div className="podcast-spotlight-eyebrow">{eyebrow}</div>
        <h3 className="podcast-spotlight-title">{title}</h3>
        {description && <p className="podcast-spotlight-desc">{description}</p>}
        <div className="podcast-spotlight-foot">
          <span className="podcast-channel">{channelName}</span>
          <span className="podcast-time">{publishedAtLabel}</span>
        </div>
        {!playing && (
          <button type="button" className="podcast-spotlight-cta" onClick={play}>
            Megnézem ▸
          </button>
        )}
      </div>
    </div>
  );
}
