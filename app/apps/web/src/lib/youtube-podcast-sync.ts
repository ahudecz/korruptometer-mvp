import 'server-only';

import { isRelevant } from '@korr/scrapers';

import type { PodcastChannelConfig } from '@app/_home/podcast-channels-config';

export interface DiscoveredVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt: Date;
}

/**
 * @handle → csatorna "uploads" lejátszási lista ID-je (YouTube Data API).
 *
 * 2026-07-15: a korábbi verzió a csatorna-RSS-t (youtube.com/feeds/videos.xml)
 * kérte le közvetlenül `httpGet`-tel — ez a `packages/scrapers` megosztott
 * robots.txt-tiszteletben-tartó HTTP-rétege miatt CSENDBEN elhasalt volna
 * minden éles futáskor, mert a YouTube robots.txt-je kifejezetten tiltja a
 * `/feeds/videos.xml` utat minden user-agentnek (`Disallow: /feeds/videos.xml`
 * a `User-agent: *` csoportban). A Data API-n keresztüli lekérdezés ezt
 * elkerüli — nem "scraping", hanem szabályos, kulcsos API-hívás, amit már
 * amúgy is használunk a nézettség-lekérdezéshez.
 */
export async function resolveUploadsPlaylistId(handle: string, apiKey: string): Promise<string | null> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`,
  );
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as
    | { items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }> }
    | null;
  return data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

/** A csatorna legutóbbi (max 15) feltöltött videója, a Data API playlistItems végpontjával. */
export async function fetchChannelVideos(uploadsPlaylistId: string, apiKey: string): Promise<DiscoveredVideo[]> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=15&playlistId=${encodeURIComponent(uploadsPlaylistId)}&key=${apiKey}`,
  );
  if (!res.ok) throw new Error(`playlistItems HTTP ${res.status}`);
  const data = (await res.json().catch(() => null)) as
    | {
        items?: Array<{
          snippet?: {
            resourceId?: { videoId?: string };
            title?: string;
            description?: string;
            publishedAt?: string;
          };
        }>;
      }
    | null;
  const out: DiscoveredVideo[] = [];
  for (const item of data?.items ?? []) {
    const videoId = item.snippet?.resourceId?.videoId;
    const title = item.snippet?.title;
    const publishedAtRaw = item.snippet?.publishedAt;
    if (!videoId || !title || !publishedAtRaw) continue;
    const publishedAt = new Date(publishedAtRaw);
    if (Number.isNaN(publishedAt.getTime())) continue;
    out.push({ videoId, title, description: item.snippet?.description ?? '', publishedAt });
  }
  return out;
}

/** Batch nézettség-lekérdezés — max 50 videó/hívás, a YouTube Data API limitje. */
export async function fetchViewCounts(videoIds: string[], apiKey: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(',')}&key=${apiKey}`,
    );
    if (!res.ok) continue;
    const data = (await res.json().catch(() => null)) as
      | { items?: Array<{ id: string; statistics?: { viewCount?: string } }> }
      | null;
    for (const item of data?.items ?? []) {
      const raw = item.statistics?.viewCount;
      if (raw) out.set(item.id, parseInt(raw, 10));
    }
  }
  return out;
}

export type VideoTier = 'in' | 'out' | 'maybe';

/**
 * Tartalmi relevancia 3 kupacban, a hír-scraper scrapeRelevanceTier()-jéhez
 * hasonlóan, de csatornaszinten konfigurálva (nincs külön videó-kulcsszólista
 * — a packages/scrapers isRelevant() magyar korrupciós/politikai kulcsszavai
 * doménfüggetlenek cím/leírás vs. videócím/leírás között):
 *   'in'    — dedikált (alwaysRelevant) csatorna, vagy kulcsszó-egyezés → ingyen jóváhagyva
 *   'maybe' — relevantByDefault csatorna, nincs kulcsszó-egyezés → AI dönt (l. scrape-youtube.ts)
 *   'out'   — se csatorna, se kulcsszó nem indokolja → eldobva, AI nélkül
 */
export function classifyVideoTier(video: DiscoveredVideo, channel: PodcastChannelConfig): VideoTier {
  if (channel.alwaysRelevant) return 'in';
  if (isRelevant(video.title, video.description)) return 'in';
  if (channel.relevantByDefault) return 'maybe';
  return 'out';
}
