import type { Metadata } from 'next';
import { and, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { getMonitoredNames } from '@/lib/breaking-monitored';
import { rankPodcastVideos } from '@/lib/podcast-ranking';
import { PodcastVideoCard } from '../_home/podcast-video-card';
import { PodcastSpotlight } from '../_home/podcast-spotlight';
import { PodcastFeatureFull } from '../_home/podcast-feature-full';

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

/** Néhány csatorna csupa nagybetűs kulcsszó-felsorolással kezdi a leírást
 *  ("TISZA PÁRT, MAGYAR PÉTER, ..."), ami mondat helyett tag-halmoznak
 *  néz ki kiírva — ezt is kihagyjuk, nem csak a túl rövid bekezdéseket. */
function looksLikeTagSalad(s: string): boolean {
  return !/[a-zíáéóúőűöü]/.test(s);
}

/** A nyers YouTube-leírás gyakran linkekkel/hashtag-halmokkal/csupa-nagybetűs
 *  kulcsszó-sorral kezdődik — ezeken végigmegyünk, amíg egy valódi,
 *  elég hosszú mondatra nem bukkanunk. Ha semmi nem marad (l. a kézzel
 *  kitűzött sorok, ahol description=''), inkább nem mutatunk semmit, mint
 *  egy törött-tűnő fél mondatot vagy egy kulcsszó-listát. */
function cleanSpotlightDescription(raw: string): string | null {
  const withoutUrls = raw.replace(/https?:\/\/\S+/g, '').trim();
  const blocks = withoutUrls.split(/\n{2,}|\n(?=#)/).map((b) => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const withoutHashtags = block.replace(/#\S+/g, '').trim();
    if (withoutHashtags.length < 30) continue;
    if (looksLikeTagSalad(withoutHashtags)) continue;
    return withoutHashtags.length > 220 ? `${withoutHashtags.slice(0, 217).trim()}…` : withoutHashtags;
  }
  return null;
}

type RankedVideo = {
  id: string;
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  publishedAt: Date;
  viewCount: number | null;
  pinnedUntil: Date | null;
};

type Block =
  | { type: 'grid'; items: RankedVideo[] }
  | { type: 'spotlight'; item: RankedVideo; flip: boolean; eyebrow: string }
  | { type: 'feature'; item: RankedVideo };

const CYCLE: ReadonlyArray<
  | { type: 'grid'; count: number }
  | { type: 'spotlight'; flip: boolean; eyebrow: string }
  | { type: 'feature' }
> = [
  { type: 'grid', count: 6 },
  { type: 'spotlight', flip: false, eyebrow: 'Kiemelt beszélgetés' },
  { type: 'grid', count: 6 },
  { type: 'feature' },
  { type: 'spotlight', flip: true, eyebrow: 'Utánajártunk' },
];

/** Rács + váltakozó spotlight-sávok + időnkénti teljes szélességű kiemelés,
 *  hogy a lap ne váljon végtelen, egyhangú 3-as rács-görgetéssé
 *  (2026-07-26, user jóváhagyással). A rangsor (rankPodcastVideos) dönti el,
 *  MELYIK videó kerül melyik pozícióba — a sablon csak eltördeli a
 *  bejövő, már rangsorolt listát ebbe a ritmusba. */
function buildBlocks(ranked: RankedVideo[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  let cycleIdx = 0;
  while (i < ranked.length) {
    const step = CYCLE[cycleIdx % CYCLE.length]!;
    if (step.type === 'grid') {
      const items = ranked.slice(i, i + step.count);
      if (items.length === 0) break;
      blocks.push({ type: 'grid', items });
      i += items.length;
    } else if (step.type === 'spotlight') {
      const item = ranked[i];
      if (!item) break;
      blocks.push({ type: 'spotlight', item, flip: step.flip, eyebrow: step.eyebrow });
      i += 1;
    } else {
      const item = ranked[i];
      if (!item) break;
      blocks.push({ type: 'feature', item });
      i += 1;
    }
    cycleIdx += 1;
  }
  return blocks;
}

export default async function PodcastokPage() {
  const db = getDb();

  const [videos, monitoredNames] = await Promise.all([
    db
      .select({
        id: schema.podcastVideos.id,
        videoId: schema.podcastVideos.videoId,
        title: schema.podcastVideos.title,
        description: schema.podcastVideos.description,
        channelName: schema.podcastVideos.channelName,
        publishedAt: schema.podcastVideos.publishedAt,
        viewCount: schema.podcastVideos.viewCount,
        pinnedUntil: schema.podcastVideos.pinnedUntil,
      })
      .from(schema.podcastVideos)
      .where(and(eq(schema.podcastVideos.reviewStatus, 'approved'), eq(schema.podcastVideos.viewThresholdMet, true))),
      // Szándékosan nincs LIMIT itt: a rangsorolás (pin > breaking > sebesség
      // > friss dátum) csak akkor helyes, ha a TELJES jóváhagyott poolt látja
      // — egy rendezés nélküli DB-oldali LIMIT tetszőleges 150 sort adna
      // vissza, és könnyen kihagyhatná pont a kitűzött videókat, mielőtt a
      // rangsoroló egyáltalán látná őket (2026-07-26, user report: emiatt
      // nem jelent meg a kitűzött hero). A lapméret-korlátot a rangsorolás
      // UTÁN, JS-ben alkalmazzuk lentebb.
    getMonitoredNames(),
  ]);

  const PAGE_SIZE = 150;
  const ranked = rankPodcastVideos(videos, monitoredNames).slice(0, PAGE_SIZE);
  const [lead, ...rest] = ranked;
  const blocks = buildBlocks(rest);

  return (
    <div className="podcast-section-wrap">
      <section className="section" id="podcastok">
        <div className="section-head">
          <div className="section-num">05 / Videóriportok és podcastok</div>
          <h2 className="section-title">Amiről beszélni kell.</h2>
        </div>

        {!lead ? (
          <div className="empty-state">Még nem érkezett kiemelt videó.</div>
        ) : (
          <>
            <PodcastSpotlight
              videoId={lead.videoId}
              title={lead.title}
              description={cleanSpotlightDescription(lead.description)}
              channelName={lead.channelName}
              publishedAtLabel={fmtRelative(lead.publishedAt)}
              eyebrow="Kiemelt beszélgetés"
              lead
            />

            {blocks.map((block, i) => {
              if (block.type === 'grid') {
                return (
                  <div className="podcast-grid" key={`grid-${i}`}>
                    {block.items.map((v) => (
                      <PodcastVideoCard
                        key={v.id}
                        videoId={v.videoId}
                        title={v.title}
                        channelName={v.channelName}
                        publishedAtLabel={fmtRelative(v.publishedAt)}
                      />
                    ))}
                  </div>
                );
              }
              if (block.type === 'spotlight') {
                return (
                  <PodcastSpotlight
                    key={`spotlight-${block.item.id}`}
                    videoId={block.item.videoId}
                    title={block.item.title}
                    description={cleanSpotlightDescription(block.item.description)}
                    channelName={block.item.channelName}
                    publishedAtLabel={fmtRelative(block.item.publishedAt)}
                    eyebrow={block.eyebrow}
                    flip={block.flip}
                  />
                );
              }
              return (
                <PodcastFeatureFull
                  key={`feature-${block.item.id}`}
                  videoId={block.item.videoId}
                  title={block.item.title}
                  channelName={block.item.channelName}
                  publishedAtLabel={fmtRelative(block.item.publishedAt)}
                />
              );
            })}
          </>
        )}
      </section>
    </div>
  );
}
