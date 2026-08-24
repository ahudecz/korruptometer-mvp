import 'server-only';
import { and, eq, isNotNull } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import { UGYEK } from '@app/_home/ugyek-config';
import { GALERIA, type PersonCaseItem } from '@app/_home/galeria-config';
import { WATCHLIST_DETAIL } from '@app/_home/watchlist-detail-config';
import { getAllRegisteredVideoIds } from '@app/_home/case-video-registry';
import type { BypassStep, BypassLogger } from '@/lib/cron-bypass';

/**
 * check.video-health — napi ellenőrzés: minden az oldalon ténylegesen
 * beágyazott/hivatkozott YouTube videó még lejátszható-e (nincs törölve,
 * nincs private-re állítva, nincs letiltva a beágyazás).
 *
 * user report, 2026-08-24: kétszer egymás után (NKA-botrány kiemelt videója,
 * majd egy második ugyanabban az ügyben) egy Molnár Áron-videó csendben
 * private-re állt, senki nem vette észre, amíg a user véletlenül rá nem
 * kattintott. Ez a cron ezt hivatott megelőzni — LLM-hívás NINCS benne
 * (a YouTube Data API videos.list endpointja ingyenes, kulcs-alapú, nem
 * Anthropic-hívás), tehát a napi LLM-keretre nulla hatással van
 * (l. [[feedback-llm-cost-isolation]] memória — ez a szabály minden jövőbeli
 * munkára vonatkozik, ez a cron is tiszteletben tartja).
 *
 * Forrás: 4 statikus config (UGYEK, GALERIA + personCases rekurzívan,
 * WATCHLIST_DETAIL + keyCases, case-video-registry.ts VIDEOS) + 2 DB tábla
 * (CourtVerdict.videoId, PodcastVideo.videoId — csak reviewStatus='approved'
 * sorok, azok jelennek meg ténylegesen az oldalon).
 */

type VideoRef = { videoId: string; label: string };

function collectGaleriaCases(cases: PersonCaseItem[] | undefined, personName: string, path: string): VideoRef[] {
  if (!cases) return [];
  const out: VideoRef[] = [];
  cases.forEach((c, i) => {
    if (c.videoId) out.push({ videoId: c.videoId, label: `GALÉRIA: ${personName} → ${path}[${i}] "${c.title}"` });
    if (c.subCases) out.push(...collectGaleriaCases(c.subCases, personName, `${path}[${i}].subCases`));
  });
  return out;
}

export function collectStaticVideoIds(): VideoRef[] {
  const refs: VideoRef[] = [];

  for (const u of UGYEK) {
    if (u.videoId) refs.push({ videoId: u.videoId, label: `ÜGY: ${u.id} (fő videó)` });
    for (const [i, v] of (u.additionalVideos ?? []).entries()) {
      refs.push({ videoId: v.id, label: `ÜGY: ${u.id} → additionalVideos[${i}] "${v.title}"` });
    }
    for (const [i, b] of (u.descriptionBlocks ?? []).entries()) {
      if (b.type === 'video') refs.push({ videoId: b.id, label: `ÜGY: ${u.id} → descriptionBlocks[${i}] "${b.title ?? b.id}"` });
    }
  }

  for (const g of GALERIA) {
    if (g.videoId) refs.push({ videoId: g.videoId, label: `GALÉRIA: ${g.name} (fő videó)` });
    refs.push(...collectGaleriaCases(g.personCases, g.name, 'personCases'));
  }

  for (const w of WATCHLIST_DETAIL) {
    if (w.videoId) refs.push({ videoId: w.videoId, label: `WATCHLIST: ${w.id} (fő videó)` });
    for (const [i, k] of w.keyCases.entries()) {
      if (k.videoId) refs.push({ videoId: k.videoId, label: `WATCHLIST: ${w.id} → keyCases[${i}] "${k.title}"` });
    }
  }

  for (const { videoId, personKey } of getAllRegisteredVideoIds()) {
    refs.push({ videoId, label: `ADATBÁZIS-SZEMÉLY: ${personKey}` });
  }

  return refs;
}

export async function collectDbVideoIds(): Promise<VideoRef[]> {
  const db = getDb();
  const refs: VideoRef[] = [];

  const verdicts = await db
    .select({ videoId: schema.courtVerdicts.videoId, personName: schema.courtVerdicts.personName })
    .from(schema.courtVerdicts)
    .where(and(isNotNull(schema.courtVerdicts.videoId), eq(schema.courtVerdicts.reviewStatus, 'approved')));
  for (const v of verdicts) {
    if (v.videoId) refs.push({ videoId: v.videoId, label: `BÍRÓSÁGI ÍTÉLET: ${v.personName}` });
  }

  const podcasts = await db
    .select({ videoId: schema.podcastVideos.videoId, title: schema.podcastVideos.title, channelName: schema.podcastVideos.channelName })
    .from(schema.podcastVideos)
    .where(eq(schema.podcastVideos.reviewStatus, 'approved'));
  for (const p of podcasts) {
    refs.push({ videoId: p.videoId, label: `PODCAST: ${p.channelName} — "${p.title}"` });
  }

  return refs;
}

type YoutubeVideoStatus = { id: string; status?: { privacyStatus?: string; embeddable?: boolean; uploadStatus?: string } };

/** Batch státusz-lekérdezés — max 50 videó/hívás, YouTube Data API limitje. */
export async function fetchVideoStatuses(videoIds: string[], apiKey: string): Promise<Map<string, YoutubeVideoStatus>> {
  const out = new Map<string, YoutubeVideoStatus>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=status&id=${batch.join(',')}&key=${apiKey}`,
    );
    if (!res.ok) continue;
    const data = (await res.json().catch(() => null)) as { items?: YoutubeVideoStatus[] } | null;
    for (const item of data?.items ?? []) out.set(item.id, item);
  }
  return out;
}

export async function runVideoHealthCheckCore({
  step,
  logger,
}: {
  step: BypassStep;
  logger?: BypassLogger;
}) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    logger?.warn?.('check-video-health: YOUTUBE_API_KEY hiányzik — a job kihagyva.');
    return { skipped: 'no-api-key' };
  }

  const allRefs = await step.run('collect-video-ids', async () => {
    const staticRefs = collectStaticVideoIds();
    const dbRefs = await collectDbVideoIds();
    return [...staticRefs, ...dbRefs];
  });

  // Dedup videoId → összes hely, ahol előfordul (ugyanaz a videó gyakran
  // több helyen is szerepel — pl. UGYEK fő videó és a hozzá tartozó
  // CourtVerdict.videoId ugyanaz lehet).
  const byId = new Map<string, string[]>();
  for (const r of allRefs) {
    const list = byId.get(r.videoId) ?? [];
    list.push(r.label);
    byId.set(r.videoId, list);
  }
  const uniqueIds = [...byId.keys()];
  if (uniqueIds.length === 0) return { checked: 0, broken: 0 };

  const statuses = await step.run('fetch-youtube-statuses', () => fetchVideoStatuses(uniqueIds, apiKey));

  const broken: Array<{ videoId: string; reason: string; labels: string[] }> = [];
  for (const id of uniqueIds) {
    const s = statuses.get(id);
    const labels = byId.get(id) ?? [];
    if (!s) {
      broken.push({ videoId: id, reason: 'nem található (törölve vagy private)', labels });
    } else if (s.status?.privacyStatus === 'private') {
      broken.push({ videoId: id, reason: 'private', labels });
    } else if (s.status?.embeddable === false) {
      broken.push({ videoId: id, reason: 'a tulajdonos letiltotta a beágyazást', labels });
    }
  }

  if (broken.length > 0) {
    await step.run('notify-broken-videos', async () => {
      const lines = broken.map((b) => {
        const where = b.labels.slice(0, 3).join('; ') + (b.labels.length > 3 ? ` (+${b.labels.length - 3} további hely)` : '');
        return `• https://youtube.com/watch?v=${b.videoId} — ${b.reason}\n  ${where}`;
      });
      await sendTelegramMessage(
        `🎬 Korruptométer: ${broken.length} elérhetetlen YouTube videó az oldalon.\n\n${lines.join('\n\n')}`,
      );
    });
  }

  logger?.info?.(`check-video-health: checked=${uniqueIds.length} broken=${broken.length}`);
  return { checked: uniqueIds.length, broken: broken.length };
}
