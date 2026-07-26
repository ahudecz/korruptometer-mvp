import { PodcastVideoBox } from './podcast-video-box';

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
  // "podcast-" előtag a variant-osztályokon is: puszta "hero"/"companion"
  // néven már van sitewide CSS-szabály (.hero = a nyitó szekció), aminek a
  // padding/margin szabályai beleöröklődtek volna ebbe a kártyába is
  // (2026-07-15, videók teteje nem volt egyvonalban emiatt).
  return (
    <div className={variant ? `podcast-card podcast-${variant}` : 'podcast-card'}>
      <PodcastVideoBox videoId={videoId} title={title} wrapClassName="podcast-video-wrap" />
      <div className="podcast-meta">
        <span className="podcast-channel">{channelName}</span>
        <span className="podcast-time">{publishedAtLabel}</span>
      </div>
      <h3 className="podcast-title">{title}</h3>
    </div>
  );
}
