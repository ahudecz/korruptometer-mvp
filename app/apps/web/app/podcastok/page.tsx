import type { Metadata } from 'next';
import { and, desc, eq, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { PodcastVideoCard } from '../_home/podcast-video-card';

export const metadata: Metadata = {
  title: 'Podcastok',
  description: 'A témába vágó YouTube-videók és podcastok gyűjteménye — automatikusan gyűjtve. Kattints, és nézd meg a legfrissebbeket!',
  openGraph: { title: 'Podcastok — Kegyencjárat', description: 'A témába vágó YouTube-videók és podcastok gyűjteménye.' },
};

export const revalidate = 120;

function fmtRelative(d: Date | string): string {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'most';
  if (h < 24) return `${h} órája`;
  if (h < 48) return 'tegnap';
  const days = Math.floor(h / 24);
  return `${days} napja`;
}

export default async function PodcastokPage() {
  const db = getDb();

  const videos = await db
    .select({
      id: schema.podcastVideos.id,
      videoId: schema.podcastVideos.videoId,
      title: schema.podcastVideos.title,
      channelName: schema.podcastVideos.channelName,
      publishedAt: schema.podcastVideos.publishedAt,
    })
    .from(schema.podcastVideos)
    .where(and(eq(schema.podcastVideos.reviewStatus, 'approved'), eq(schema.podcastVideos.viewThresholdMet, true)))
    .orderBy(
      desc(sql`(${schema.podcastVideos.pinnedUntil} IS NOT NULL AND ${schema.podcastVideos.pinnedUntil} > now())`),
      desc(schema.podcastVideos.publishedAt),
    )
    .limit(60);

  const [hero, ...others] = videos;
  const companions = others.slice(0, 2);
  const rest = others.slice(2);

  return (
    <div className="podcast-section-wrap">
      <section className="section" id="podcastok">
        <div className="section-head">
          <div className="section-num">05 / Videóriportok és podcastok</div>
          <h2 className="section-title">Amiről beszélni kell.</h2>
        </div>

        {!hero ? (
          <div className="empty-state">Még nem érkezett kiemelt videó.</div>
        ) : (
          <>
            <div className="podcast-featured-grid">
              <PodcastVideoCard
                videoId={hero.videoId}
                title={hero.title}
                channelName={hero.channelName}
                publishedAtLabel={fmtRelative(hero.publishedAt)}
                variant="hero"
              />
              {companions.map((v) => (
                <PodcastVideoCard
                  key={v.id}
                  videoId={v.videoId}
                  title={v.title}
                  channelName={v.channelName}
                  publishedAtLabel={fmtRelative(v.publishedAt)}
                  variant="companion"
                />
              ))}
            </div>
            {rest.length > 0 && (
              <div className="podcast-grid">
                {rest.map((v) => (
                  <PodcastVideoCard
                    key={v.id}
                    videoId={v.videoId}
                    title={v.title}
                    channelName={v.channelName}
                    publishedAtLabel={fmtRelative(v.publishedAt)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
