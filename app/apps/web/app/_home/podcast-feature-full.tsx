import { PodcastVideoBox } from './podcast-video-box';

export function PodcastFeatureFull({
  videoId,
  title,
  channelName,
  publishedAtLabel,
}: {
  videoId: string;
  title: string;
  channelName: string;
  publishedAtLabel: string;
}) {
  return (
    <div className="podcast-feature-full">
      <div className="podcast-feature-full-inner">
        <PodcastVideoBox videoId={videoId} title={title} wrapClassName="podcast-feature-full-video-wrap" />
        <div className="podcast-feature-full-caption">
          <h3 className="podcast-feature-full-title">{title}</h3>
          <div className="podcast-feature-full-side">
            <span className="podcast-channel">{channelName}</span>
            <span className="podcast-time">{publishedAtLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
