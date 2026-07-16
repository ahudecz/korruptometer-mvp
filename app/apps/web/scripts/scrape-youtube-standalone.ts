/**
 * Inngest-bypass for scrape-youtube (Inngest account still over quota,
 * 2026-07-16 — same root cause as the Facebook-sync bypass, see
 * packages/db/src/fb-sync-apify.ts and project-facebook-sync.md memory).
 *
 * Re-implements the scrape-youtube Inngest function's logic standalone,
 * without importing the 'server-only'-guarded apps/web/src/lib/* modules
 * (ai-classify.ts, notify.ts, telegram.ts, youtube-podcast-sync.ts,
 * breaking-monitored.ts) — their bodies are copied in here instead, using
 * raw `postgres` SQL rather than the Drizzle `getDb()` client, matching the
 * fb-sync-apify.ts pattern.
 *
 * Known simplification vs. the real Inngest function: getMonitoredNames()
 * is ported faithfully (same config + DB union), so isBreaking() detection
 * should be equivalent.
 *
 * DRY_RUN=1: reports discovered/would-insert/would-need-LLM counts, does
 * NOT write to the DB, does NOT call the LLM, does NOT send Telegram
 * messages.
 *
 * Usage: DRY_RUN=1 npx tsx scripts/scrape-youtube-standalone.ts
 *        npx tsx scripts/scrape-youtube-standalone.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: resolve(__dirname, '../.env.local') });
loadEnv({ path: resolve(__dirname, '../../../.env.local') });

import postgres from 'postgres';
import { isRelevant, isBreaking, BREAKING_MONITORED_FALLBACK } from '@korr/scrapers';
import { llmExtract, type LlmToolSpec } from '@korr/db/llm';
import { PODCAST_CHANNELS, type PodcastChannelConfig } from '../app/_home/podcast-channels-config';
import { GALERIA } from '../app/_home/galeria-config';
import { WATCH_LIST } from '../app/_home/watchlist-config';
import { UGYEK } from '../app/_home/ugyek-config';

const DRY_RUN = process.env.DRY_RUN === '1';
// 2026-07-16 user choice: insert the free 'in'-tier videos for real, but
// skip the 'maybe'-tier LLM classification pass entirely this run (cost).
const SKIP_LLM = process.env.SKIP_LLM === '1';
const VIEW_REFRESH_WINDOW_DAYS = 14;

const DB_URL = process.env.PROD_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DB_URL) throw new Error('PROD_DATABASE_URL / DATABASE_URL not set');
const sql = postgres(DB_URL, { prepare: false, max: 3 });

const YT_API_KEY = process.env.YOUTUBE_API_KEY;
if (!YT_API_KEY) throw new Error('YOUTUBE_API_KEY not set');

// ─── YouTube Data API helpers (ported from src/lib/youtube-podcast-sync.ts) ──

type DiscoveredVideo = { videoId: string; title: string; description: string; publishedAt: Date };

async function resolveUploadsPlaylistId(handle: string): Promise<string | null> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(handle)}&key=${YT_API_KEY}`,
  );
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as
    | { items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }> }
    | null;
  return data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

async function fetchChannelVideos(uploadsPlaylistId: string): Promise<DiscoveredVideo[]> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=15&playlistId=${encodeURIComponent(uploadsPlaylistId)}&key=${YT_API_KEY}`,
  );
  if (!res.ok) throw new Error(`playlistItems HTTP ${res.status}`);
  const data = (await res.json().catch(() => null)) as
    | { items?: Array<{ snippet?: { resourceId?: { videoId?: string }; title?: string; description?: string; publishedAt?: string } }> }
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

async function fetchViewCounts(videoIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(',')}&key=${YT_API_KEY}`);
    if (!res.ok) continue;
    const data = (await res.json().catch(() => null)) as { items?: Array<{ id: string; statistics?: { viewCount?: string } }> } | null;
    for (const item of data?.items ?? []) {
      const raw = item.statistics?.viewCount;
      if (raw) out.set(item.id, parseInt(raw, 10));
    }
  }
  return out;
}

type VideoTier = 'in' | 'out' | 'maybe';
function classifyVideoTier(video: DiscoveredVideo, channel: PodcastChannelConfig, extraNames: string[]): VideoTier {
  if (channel.alwaysRelevant) return 'in';
  if (isRelevant(video.title, video.description, extraNames)) return 'in';
  if (channel.relevantByDefault) return 'maybe';
  return 'out';
}

// ─── LLM classification (ported from src/lib/ai-classify.ts) ────────────────

const CLASSIFY_SYSTEM = `Te egy magyar politikai hírszerkesztő asszisztens vagy egy NER/Fidesz-korrupciót figyelő portál számára. Adott egy cikk headline és excerpt szöveg. Feladatod:
1. Eldönteni, hogy a cikk releváns-e. KIZÁRÓLAG akkor releváns, ha konkrétan a NER-hez, a Fideszhez, vagy kormányzati/állami szereplőkhöz/intézményekhez köthető korrupcióról, közpénz-visszaélésről, lemondásról/kirúgásról, vagy médiaügyről szól.
   NEM releváns, még ha első ránézésre kapcsolódónak is tűnik:
   - Külföldi hírek, háborúk, nemzetközi konfliktusok — kivéve, ha konkrétan egy NER-es/Fideszes szereplőről vagy magyar kormányzati ügyről szól.
   - Általános gazdasági/vállalati hírek, ahol nincs NER/Fidesz-kötődés (pl. egy magáncég környezetszennyezése, egy gazda pere egy céggel) — attól, hogy egy állami hivatal a szokásos, rutinszerű hatósági szerepében megjelenik (pl. bírságot szab ki), MÉG NEM közpénz-ügy.
   - Bűnügyi hírek NER/Fidesz-kötődés nélkül.
2. Ha releváns: írj egy max. 2 mondatos, tömör magyar összefoglalót (excerpt). Legyen konkrét, ne általános.
3. Ha releváns: rendelj hozzá egyet ezek közül a tagek közül: korrupció | lemondás | médiaügy | közpénz | NER-vagyon | jogállamiság | egyéb`;

const CLASSIFY_TOOL: LlmToolSpec = {
  name: 'classify_article',
  description: 'Classify a Hungarian news article for a corruption-watch portal.',
  schema: {
    type: 'object',
    properties: {
      relevant: { type: 'boolean', description: 'True if relevant to NER/Fidesz/corruption/public-money/resignations/media topics.' },
      excerpt: { type: 'string', description: 'Max 2-sentence concise Hungarian summary. Empty if not relevant.' },
      tag: { type: 'string', description: 'One of: korrupció | lemondás | médiaügy | közpénz | NER-vagyon | jogállamiság | egyéb. Empty if not relevant.' },
    },
    required: ['relevant', 'excerpt', 'tag'],
  },
};

async function classifyArticle(headline: string, rawExcerpt: string) {
  const { data, inputTokens, outputTokens } = await llmExtract<{ relevant: boolean; excerpt: string; tag: string | null }>({
    system: CLASSIFY_SYSTEM,
    user: `Headline: ${headline}\nExcerpt: ${rawExcerpt}`,
    tool: CLASSIFY_TOOL,
    maxTokens: 300,
  });
  if (!data) return { relevant: true, excerpt: rawExcerpt, tag: null, inputTokens, outputTokens, apiFailed: true };
  return { relevant: Boolean(data.relevant), apiFailed: false, excerpt: data.excerpt?.slice(0, 500) || rawExcerpt, tag: data.tag || null, inputTokens, outputTokens };
}

// ─── Telegram (ported from src/lib/telegram.ts + notify.ts) ─────────────────

type InlineKeyboardMarkup = { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> };

async function sendTelegramMessage(text: string, replyMarkup?: InlineKeyboardMarkup): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
    });
  } catch {
    // never let notification delivery break the run
  }
}

async function notifyPodcastReviewNeeded(video: { id: string; videoId: string; title: string; channelName: string }) {
  const url = `https://www.youtube.com/watch?v=${video.videoId}`;
  await sendTelegramMessage(`🔔 ÁTNÉZENDŐ — Podcast/videó\n${video.channelName}: ${video.title}`, {
    inline_keyboard: [
      [{ text: '▶️ Megnézem', url }],
      [{ text: '✅ Jóváhagyom', callback_data: `a:y:${video.id}` }, { text: '❌ Elutasítom', callback_data: `r:y:${video.id}` }],
    ],
  });
}

async function notifyPodcastBreakingBelowThreshold(video: { id: string; videoId: string; title: string; channelName: string }) {
  const url = `https://www.youtube.com/watch?v=${video.videoId}`;
  await sendTelegramMessage(
    `⚡ BREAKING, DE KÜSZÖB ALATT — Podcast/videó\n${video.channelName}: ${video.title}\nNem érte el a csatorna nézettségi küszöbét, de fontosnak tűnik — kézzel korábban is publikálható.`,
    {
      inline_keyboard: [
        [{ text: '▶️ Megnézem', url }],
        [{ text: '✅ Publikálom most', callback_data: `a:y:${video.id}` }, { text: '👍 Várunk a küszöbre', callback_data: `r:y:${video.id}` }],
      ],
    },
  );
}

// ─── Monitored names (ported from src/lib/breaking-monitored.ts) ────────────

async function getMonitoredNames(): Promise<string[]> {
  const names = new Set<string>(BREAKING_MONITORED_FALLBACK);
  try {
    for (const p of WATCH_LIST) names.add(p.name.toLowerCase());
    for (const g of GALERIA) names.add(g.name.toLowerCase());
    for (const u of UGYEK) for (const kw of u.articleKeywords ?? []) names.add(kw.toLowerCase());
  } catch {
    // config import failure — fall through
  }
  try {
    const scandalPersons = await sql<{ person: string }[]>`SELECT DISTINCT person FROM "ScandalCatalog" WHERE person IS NOT NULL AND person LIKE '% %'`;
    const resignations = await sql<{ name: string }[]>`SELECT name FROM "PoliticalResignation" WHERE "reviewStatus" = 'approved'`;
    const verdicts = await sql<{ personName: string }[]>`SELECT "personName" FROM "CourtVerdict"`;
    for (const r of scandalPersons) if (r.person) names.add(r.person.toLowerCase());
    for (const r of resignations) if (r.name?.includes(' ')) names.add(r.name.toLowerCase());
    for (const r of verdicts) if (r.personName?.includes(' ')) names.add(r.personName.toLowerCase());
  } catch {
    // DB unavailable — config-derived + static names above still apply
  }
  return Array.from(names);
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`target: ${new URL(DB_URL!).host}${DRY_RUN ? ' (DRY_RUN)' : ''}${SKIP_LLM ? ' (SKIP_LLM)' : ''}`);

  const knownRows = await sql<{ videoId: string }[]>`SELECT "videoId" FROM "PodcastVideo"`;
  const knownSet = new Set(knownRows.map((r) => r.videoId));
  const monitoredNames = await getMonitoredNames();
  console.log(`known videos: ${knownSet.size}, monitored names: ${monitoredNames.length}`);

  let totalDiscovered = 0, totalInserted = 0, totalPendingNotified = 0, totalBreakingNotified = 0, totalMaybe = 0;

  for (const channel of PODCAST_CHANNELS) {
    const uploadsPlaylistId = await resolveUploadsPlaylistId(channel.handle);
    if (!uploadsPlaylistId) {
      console.log(`  [${channel.slug}] resolve-failed`);
      continue;
    }
    let videos: DiscoveredVideo[];
    try {
      videos = await fetchChannelVideos(uploadsPlaylistId);
    } catch (err) {
      console.log(`  [${channel.slug}] playlist-fetch-failed: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    let discovered = 0, inserted = 0, pendingNotified = 0, breakingNotified = 0, maybeCount = 0;
    for (const video of videos) {
      if (knownSet.has(video.videoId)) continue;
      discovered++;
      const tier = classifyVideoTier(video, channel, monitoredNames);
      if (tier === 'out') continue;

      if (tier === 'in') {
        const meetsThreshold = channel.viewThreshold <= 0;
        if (DRY_RUN) {
          inserted++;
          continue;
        }
        const rows = await sql`
          INSERT INTO "PodcastVideo" ("videoId", "channelSlug", "channelName", title, description, "publishedAt", "reviewStatus", "viewThresholdMet")
          VALUES (${video.videoId}, ${channel.slug}, ${channel.name}, ${video.title.slice(0, 500)}, ${video.description.slice(0, 2000)}, ${video.publishedAt}, 'approved', ${meetsThreshold})
          ON CONFLICT ("videoId") DO NOTHING
          RETURNING id
        `;
        if (rows[0]) {
          inserted++;
          if (!meetsThreshold && isBreaking(video.title, video.description, monitoredNames)) {
            breakingNotified++;
            await notifyPodcastBreakingBelowThreshold({ id: rows[0].id as string, videoId: video.videoId, title: video.title, channelName: channel.name });
          }
        }
        continue;
      }

      // tier === 'maybe'
      maybeCount++;
      if (DRY_RUN || SKIP_LLM) continue; // don't spend LLM budget
      const ai = await classifyArticle(video.title, video.description);
      if (!ai.relevant && !ai.apiFailed) continue;
      const rows = await sql`
        INSERT INTO "PodcastVideo" ("videoId", "channelSlug", "channelName", title, description, "publishedAt", "reviewStatus", "viewThresholdMet")
        VALUES (${video.videoId}, ${channel.slug}, ${channel.name}, ${video.title.slice(0, 500)}, ${video.description.slice(0, 2000)}, ${video.publishedAt}, 'pending', false)
        ON CONFLICT ("videoId") DO NOTHING
        RETURNING id
      `;
      if (rows[0]) {
        inserted++;
        pendingNotified++;
        await notifyPodcastReviewNeeded({ id: rows[0].id as string, videoId: video.videoId, title: video.title, channelName: channel.name });
      }
    }

    if (discovered > 0 || maybeCount > 0) {
      console.log(`  [${channel.slug}] discovered=${discovered} inserted=${inserted} maybe=${maybeCount} pendingNotified=${pendingNotified} breakingNotified=${breakingNotified}`);
    }
    totalDiscovered += discovered;
    totalInserted += inserted;
    totalPendingNotified += pendingNotified;
    totalBreakingNotified += breakingNotified;
    totalMaybe += maybeCount;
  }

  console.log(
    `\nTOTAL: discovered=${totalDiscovered} inserted=${totalInserted} maybe(would-need-LLM)=${totalMaybe} pendingNotified=${totalPendingNotified} breakingNotified=${totalBreakingNotified}`,
  );

  if (!DRY_RUN) {
    // View-count refresh, same as the Inngest function's second half.
    const cutoff = new Date(Date.now() - VIEW_REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const candidates = await sql<{ id: string; videoId: string; channelSlug: string }[]>`
      SELECT id, "videoId", "channelSlug" FROM "PodcastVideo"
      WHERE "reviewStatus" = 'approved' AND "viewThresholdMet" = false AND "publishedAt" >= ${cutoff}
    `;
    if (candidates.length > 0) {
      const counts = await fetchViewCounts(candidates.map((c) => c.videoId));
      let promoted = 0;
      for (const c of candidates) {
        const viewCount = counts.get(c.videoId);
        if (viewCount === undefined) continue;
        const channel = PODCAST_CHANNELS.find((ch) => ch.slug === c.channelSlug);
        const threshold = channel?.viewThreshold ?? Number.POSITIVE_INFINITY;
        const met = viewCount >= threshold;
        await sql`UPDATE "PodcastVideo" SET "viewCount" = ${viewCount}, "viewThresholdMet" = ${met}, "lastViewCheckAt" = now(), "updatedAt" = now() WHERE id = ${c.id}`;
        if (met) promoted++;
      }
      console.log(`view-count refresh: checked=${candidates.length} promoted=${promoted}`);
    }
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
