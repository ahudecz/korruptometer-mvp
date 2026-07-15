import 'server-only';
import { and, eq, gte } from 'drizzle-orm';
import { isBreaking } from '@korr/scrapers';

import { getDb, schema } from '@/lib/db';
import { classifyArticle } from '@/lib/ai-classify';
import { getMonitoredNames } from '@/lib/breaking-monitored';
import { notifyPodcastBreakingBelowThreshold, notifyPodcastReviewNeeded } from '@/lib/notify';
import {
  classifyVideoTier,
  fetchChannelVideos,
  fetchViewCounts,
  resolveUploadsPlaylistId,
  type DiscoveredVideo,
} from '@/lib/youtube-podcast-sync';
import { PODCAST_CHANNELS } from '@app/_home/podcast-channels-config';

import { inngest } from '../client';

const VIEW_REFRESH_WINDOW_DAYS = 14;

/**
 * scrape.youtube — a "legfrissebb podcastok" homepage-blokk feltöltője.
 * YouTube Data API playlistItems-ből (uploads lejátszási lista) fedez fel
 * új videókat — NEM a csatorna-RSS-ből, mert a youtube.com/robots.txt
 * kifejezetten tiltja a /feeds/videos.xml utat minden user-agentnek.
 * Tartalmi relevanciát dönt
 * (csatorna + kulcsszó, l. classifyVideoTier), a bizonytalan ("maybe")
 * eseteket Haiku-val osztályozza — de eltérően a hír-pipeline néma
 * AI-döntésétől, itt a "releváns" AI-eredmény IS mindig Telegramra megy
 * jóváhagyásra (user explicit kérése: emberi kontroll egy új, kísérleti
 * content-típuson). Csatornánkénti nézettségi küszöb (PODCAST_CHANNELS)
 * kapuzza a tényleges megjelenítést (viewThresholdMet), függetlenül a
 * tartalmi jóváhagyástól — ezt a job második fele frissíti (refresh-view-counts).
 *
 * YOUTUBE_API_KEY nélkül a teljes job no-op (a @handle → channel_id feloldás
 * is ehhez kötött, nem csak a nézettség-lekérdezés).
 */
export const scrapeYoutube = inngest.createFunction(
  { id: 'scrape-youtube', name: 'Scrape YouTube podcasts', concurrency: 1 },
  [{ event: 'youtube.sync' }, { cron: '10 * * * *' }],
  async ({ step, logger }) => {
    const db = getDb();
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      logger?.warn?.('scrape-youtube: YOUTUBE_API_KEY hiányzik — a job kihagyva.');
      return { skipped: 'no-api-key' };
    }

    const knownVideoIds = await step.run('list-known-video-ids', async () => {
      const rows = await db.select({ videoId: schema.podcastVideos.videoId }).from(schema.podcastVideos);
      return rows.map((r) => r.videoId);
    });
    const knownSet = new Set(knownVideoIds);

    // Ugyanaz a monitoredNames-lista, mint a hír-scraper isBreaking()-je
    // (WATCH_LIST/GALERIA/UGYEK configok + DB-nevek uniója), egyszer
    // kiszámolva a teljes futásra — l. breaking-monitored.ts.
    const monitoredNames = await step.run('monitored-names', () => getMonitoredNames());

    let totalDiscovered = 0;
    let totalInserted = 0;
    let totalPendingNotified = 0;
    let totalBreakingNotified = 0;

    for (const channel of PODCAST_CHANNELS) {
      const result = await step.run(`sync-${channel.slug}`, async () => {
        const uploadsPlaylistId = await resolveUploadsPlaylistId(channel.handle, apiKey);
        if (!uploadsPlaylistId) {
          return { discovered: 0, inserted: 0, pendingNotified: 0, breakingNotified: 0, error: 'resolve-failed' as const };
        }

        let videos: DiscoveredVideo[];
        try {
          videos = await fetchChannelVideos(uploadsPlaylistId, apiKey);
        } catch (err) {
          return {
            discovered: 0,
            inserted: 0,
            pendingNotified: 0,
            breakingNotified: 0,
            error: err instanceof Error ? err.message : 'playlist-fetch-failed',
          };
        }

        let discovered = 0;
        let inserted = 0;
        let pendingNotified = 0;
        let breakingNotified = 0;

        for (const video of videos) {
          if (knownSet.has(video.videoId)) continue;
          discovered++;

          const tier = classifyVideoTier(video, channel);
          if (tier === 'out') continue; // ingyen eldobva, be sem kerül a DB-be

          if (tier === 'in') {
            const meetsThreshold = channel.viewThreshold <= 0;
            const rows = await db
              .insert(schema.podcastVideos)
              .values({
                videoId: video.videoId,
                channelSlug: channel.slug,
                channelName: channel.name,
                title: video.title.slice(0, 500),
                description: video.description.slice(0, 2000),
                publishedAt: video.publishedAt,
                reviewStatus: 'approved',
                viewThresholdMet: meetsThreshold,
              })
              .onConflictDoNothing({ target: schema.podcastVideos.videoId })
              .returning({ id: schema.podcastVideos.id });
            if (rows[0]) {
              inserted++;
              // Küszöb alatt van, de a rendszer "breaking"-nek ítéli (l.
              // isBreaking — börtön/eljárás-trigger + figyelt személy a
              // címben) → azonnali Telegram-értesítés, kézzel korábban is
              // publikálható legyen, ne kelljen megvárni a szerves felfutást.
              if (!meetsThreshold && isBreaking(video.title, video.description, monitoredNames)) {
                breakingNotified++;
                await notifyPodcastBreakingBelowThreshold({
                  id: rows[0].id,
                  videoId: video.videoId,
                  title: video.title,
                  channelName: channel.name,
                });
              }
            }
            continue;
          }

          // tier === 'maybe' — Haiku dönt, de az eredmény MINDIG Telegramra megy,
          // ha releváns (vagy ha maga az AI-hívás hibázott — bizonytalanság
          // mindkét esetben emberi jóváhagyást kap, nem automatikus döntést).
          const ai = await classifyArticle(video.title, video.description);
          if (!ai.relevant && !ai.apiFailed) continue; // AI szerint egyértelműen nem releváns

          const rows = await db
            .insert(schema.podcastVideos)
            .values({
              videoId: video.videoId,
              channelSlug: channel.slug,
              channelName: channel.name,
              title: video.title.slice(0, 500),
              description: video.description.slice(0, 2000),
              publishedAt: video.publishedAt,
              reviewStatus: 'pending',
              viewThresholdMet: false,
            })
            .onConflictDoNothing({ target: schema.podcastVideos.videoId })
            .returning({ id: schema.podcastVideos.id });
          if (rows[0]) {
            inserted++;
            pendingNotified++;
            await notifyPodcastReviewNeeded({
              id: rows[0].id,
              videoId: video.videoId,
              title: video.title,
              channelName: channel.name,
            });
          }
        }

        return { discovered, inserted, pendingNotified, breakingNotified };
      });

      if ('error' in result) {
        logger?.warn?.(`scrape-youtube: "${channel.slug}" hiba — ${result.error}`);
      }
      totalDiscovered += result.discovered;
      totalInserted += result.inserted;
      totalPendingNotified += result.pendingNotified;
      totalBreakingNotified += result.breakingNotified;
    }

    // Nézettség-frissítés: a topikailag már jóváhagyott, de a csatorna
    // küszöbét még el nem érő, legfeljebb 14 napos videók batch-ellenőrzése.
    const refresh = await step.run('refresh-view-counts', async () => {
      const cutoff = new Date(Date.now() - VIEW_REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const candidates = await db
        .select({ id: schema.podcastVideos.id, videoId: schema.podcastVideos.videoId, channelSlug: schema.podcastVideos.channelSlug })
        .from(schema.podcastVideos)
        .where(
          and(
            eq(schema.podcastVideos.reviewStatus, 'approved'),
            eq(schema.podcastVideos.viewThresholdMet, false),
            gte(schema.podcastVideos.publishedAt, cutoff),
          ),
        );
      if (candidates.length === 0) return { checked: 0, promoted: 0 };

      const counts = await fetchViewCounts(candidates.map((c) => c.videoId), apiKey);
      let promoted = 0;
      for (const c of candidates) {
        const viewCount = counts.get(c.videoId);
        if (viewCount === undefined) continue;
        const channel = PODCAST_CHANNELS.find((ch) => ch.slug === c.channelSlug);
        const threshold = channel?.viewThreshold ?? Number.POSITIVE_INFINITY;
        const met = viewCount >= threshold;
        await db
          .update(schema.podcastVideos)
          .set({ viewCount, viewThresholdMet: met, lastViewCheckAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.podcastVideos.id, c.id));
        if (met) promoted++;
      }
      return { checked: candidates.length, promoted };
    });

    logger?.info?.(
      `scrape-youtube: ${totalDiscovered} felfedezve, ${totalInserted} beszúrva (${totalPendingNotified} bizonytalan + ${totalBreakingNotified} breaking-küszöb-alatt Telegramra küldve), ${refresh.checked} nézettség-ellenőrzés (${refresh.promoted} átlépte a küszöböt).`,
    );

    return {
      discovered: totalDiscovered,
      inserted: totalInserted,
      pendingNotified: totalPendingNotified,
      breakingNotified: totalBreakingNotified,
      ...refresh,
    };
  },
);
