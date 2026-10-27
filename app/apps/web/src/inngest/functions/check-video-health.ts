import 'server-only';
import { and, desc, eq, ilike, inArray, isNotNull, notInArray, or } from 'drizzle-orm';

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
 * sorok, podcastnál ráadásul csak viewThresholdMet=true: azok jelennek meg
 * ténylegesen az oldalon).
 *
 * 2026-10-27 — user kérés: a riasztás ne csak egy lista legyen.
 *  - PODCAST: az elérhetetlen videó sorát a cron TÖRLI (a /podcastok oldal és
 *    a nyitóoldal ebből a táblából olvas, így azonnal eltűnik).
 *  - BÍRÓSÁGI ÍTÉLET: a sor videoId-ja NULL lesz (a sor maga marad).
 *  - KÉZI CONFIG (ügyoldal, galéria, lemondás-oldal, adatbázis-személy): a
 *    kódot a cron nem tudja átírni (a user döntése: nincs külön tábla), ezért
 *    a Telegram-üzenet helyenként leírja, hol van (link), és ha ugyanott van
 *    másik videó, melyik lépjen elő kiemeltnek; ha egyedüli volt,
 *    cserejavaslatot ad a kint lévő podcast-videók közül (névegyezés, LLM nélkül).
 *  - Biztonsági zár: ami egy elszállt YouTube-hívásban volt, azt NEM vesszük
 *    hiányzónak; ha a hiányzók aránya gyanúsan magas, semmit nem töröl.
 */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.kegyencjarat.hu').replace(/\/+$/, '');
/** E fölött az arány fölött API-hibára gyanakszunk, és nem törlünk semmit. */
const MAX_AUTO_FIX_RATIO = 0.2;

export type VideoRef = {
  videoId: string;
  /** Hol jelenik meg — emberi olvasásra. */
  label: string;
  linkOnly?: boolean;
  source: 'static' | 'podcast' | 'verdict';
  /** Az oldal útvonala, ha egyértelmű (pl. /ugyek/mnb-botrany). */
  path?: string;
  /** Kiemelt (hero / fő) hely-e. */
  featured?: boolean;
  /** Ugyanazon az oldalon lévő többi videó, sorrendben (előléptetéshez). */
  siblings?: Array<{ videoId: string; title: string; where: string }>;
  /** Cserejavaslathoz: személy- vagy ügynév. */
  keywords?: string[];
};

function collectGaleriaCases(cases: PersonCaseItem[] | undefined, personName: string, galeriaId: string): VideoRef[] {
  if (!cases) return [];
  const out: VideoRef[] = [];
  for (const c of cases) {
    if (c.videoId) {
      out.push({
        videoId: c.videoId,
        label: `GALÉRIA: ${personName} — „${c.title}” ügy videója`,
        source: 'static',
        path: `/galeria/${galeriaId}`,
        keywords: [personName],
      });
    }
    out.push(...collectGaleriaCases(c.subCases, personName, galeriaId));
  }
  return out;
}

export function collectStaticVideoIds(): VideoRef[] {
  const refs: VideoRef[] = [];

  for (const u of UGYEK) {
    const path = `/ugyek/${u.id}`;
    const keywords = [...(u.responsiblePersons ?? []), ...(u.responsible ? [u.responsible] : []), u.title];
    const extra = u.additionalVideos ?? [];
    // Az ügyoldal videósora: a `featured` a nagy hero-csempe, a többi mellette.
    const siblingsOf = (exclude: string) =>
      extra.filter((v) => v.id !== exclude).map((v) => ({ videoId: v.id, title: v.title, where: v.featured ? 'kiemelt a videósorban' : 'videósor' }));
    if (u.videoId) {
      refs.push({ videoId: u.videoId, label: `ÜGYOLDAL: ${u.title} — fő videó (a lap tetején)`, source: 'static', path, featured: true, siblings: siblingsOf(u.videoId), keywords });
    }
    for (const v of extra) {
      refs.push({
        videoId: v.id,
        label: `ÜGYOLDAL: ${u.title} — ${v.featured ? 'KIEMELT videó a videósorban' : 'videósor'}: „${v.title}”`,
        source: 'static',
        path,
        featured: !!v.featured,
        siblings: siblingsOf(v.id),
        keywords,
      });
    }
    if (u.breakingUpdate?.video) {
      refs.push({ videoId: u.breakingUpdate.video.id, label: `ÜGYOLDAL: ${u.title} — BREAKING doboz videója: „${u.breakingUpdate.video.title}”`, source: 'static', path, keywords });
    }
    for (const b of u.descriptionBlocks ?? []) {
      if (b.type === 'video') {
        refs.push({ videoId: b.id, label: `ÜGYOLDAL: ${u.title} — leírásba ágyazott videó: „${b.title ?? b.id}”`, source: 'static', path, keywords });
      }
    }
  }

  for (const g of GALERIA) {
    if (g.videoId) {
      refs.push({ videoId: g.videoId, label: `GALÉRIA: ${g.name} — fő videó`, source: 'static', path: `/galeria/${g.id}`, featured: true, keywords: [g.name] });
    }
    refs.push(...collectGaleriaCases(g.personCases, g.name, g.id));
  }

  for (const w of WATCHLIST_DETAIL) {
    const keywords = w.newsKeywords.slice(0, 2);
    if (w.videoId) {
      refs.push({ videoId: w.videoId, label: `LEMONDÁS-OLDAL: ${w.id} — fő videó`, source: 'static', path: `/lemondasok/${w.id}`, featured: true, keywords });
    }
    for (const k of w.keyCases) {
      if (k.videoId) {
        refs.push({ videoId: k.videoId, label: `LEMONDÁS-OLDAL: ${w.id} — „${k.title}” videója`, source: 'static', path: `/lemondasok/${w.id}`, keywords });
      }
    }
  }

  for (const { videoId, personKey, linkOnly } of getAllRegisteredVideoIds()) {
    refs.push({ videoId, label: `ADATBÁZIS-ÜGYOLDALAK: ${personKey} személyes videója (case-video-registry.ts)`, linkOnly, source: 'static', keywords: [personKey] });
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
    if (v.videoId) refs.push({ videoId: v.videoId, label: `BÍRÓSÁGI ÍTÉLET: ${v.personName}`, source: 'verdict', path: '/birosagi-iteletek' });
  }

  const podcasts = await db
    .select({ videoId: schema.podcastVideos.videoId, title: schema.podcastVideos.title, channelName: schema.podcastVideos.channelName })
    .from(schema.podcastVideos)
    // 2026-10-01: csak a nézettségi küszöböt elért (viewThresholdMet) sor
    // jelenik meg az oldalon (/podcastok, nyitóoldal) — a küszöb alatti
    // 'approved' sort ellenőrizni téves riasztás (ATV élő adás, LlhcZ8rViuw:
    // „elérhetetlen videó az oldalon", holott sehol nem volt kint).
    .where(and(eq(schema.podcastVideos.reviewStatus, 'approved'), eq(schema.podcastVideos.viewThresholdMet, true)));
  for (const p of podcasts) {
    refs.push({ videoId: p.videoId, label: `PODCAST: ${p.channelName} — „${p.title}”`, source: 'podcast', path: '/podcastok' });
  }

  return refs;
}

type YoutubeVideoStatus = { id: string; status?: { privacyStatus?: string; embeddable?: boolean; uploadStatus?: string } };

/**
 * Batch státusz-lekérdezés — max 50 videó/hívás, YouTube Data API limitje.
 * `checked` csak a SIKERES hívások azonosítóit tartalmazza: ami egy elszállt
 * hívásban volt, arról nem tudunk semmit, és nem szabad hiányzónak venni
 * (különben egy API-kiesés az összes podcast-sort törölné).
 */
export async function fetchVideoStatuses(
  videoIds: string[],
  apiKey: string,
): Promise<{ statuses: Record<string, YoutubeVideoStatus>; checked: string[] }> {
  const statuses: Record<string, YoutubeVideoStatus> = {};
  const checked: string[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${batch.join(',')}&key=${apiKey}`).catch(() => null);
    if (!res?.ok) continue;
    const data = (await res.json().catch(() => null)) as { items?: YoutubeVideoStatus[] } | null;
    if (!data) continue;
    for (const item of data.items ?? []) statuses[item.id] = item;
    checked.push(...batch);
  }
  return { statuses, checked };
}

export type BrokenVideo = { videoId: string; reason: string; refs: VideoRef[] };

/** Mely videók hibásak — tiszta függvény, I/O nélkül. */
export function findBrokenVideos(refs: VideoRef[], statuses: Record<string, YoutubeVideoStatus>, checked: Iterable<string>): BrokenVideo[] {
  const checkedSet = new Set(checked);
  const byId = new Map<string, VideoRef[]>();
  for (const r of refs) byId.set(r.videoId, [...(byId.get(r.videoId) ?? []), r]);
  const broken: BrokenVideo[] = [];
  for (const [id, rs] of byId) {
    if (!checkedSet.has(id)) continue;
    const s = statuses[id];
    // A beágyazás-tiltás csak akkor hiba, ha legalább egy hely iframe-ként ágyaz be.
    const allLinkOnly = rs.every((r) => r.linkOnly);
    if (!s) broken.push({ videoId: id, reason: 'nem elérhető (törölve vagy privát)', refs: rs });
    else if (s.status?.privacyStatus === 'private') broken.push({ videoId: id, reason: 'privát', refs: rs });
    else if (s.status?.embeddable === false && !allLinkOnly) broken.push({ videoId: id, reason: 'a tulajdonos letiltotta a beágyazást', refs: rs });
  }
  return broken;
}

/** Ugyanazon az oldalon az első működő másik videó (előléptetéshez), ha van. */
export function promotionFor(ref: VideoRef, brokenIds: Set<string>): { videoId: string; title: string; where: string } | null {
  return (ref.siblings ?? []).find((s) => !brokenIds.has(s.videoId)) ?? null;
}

/** Cserejavaslat a kint lévő podcast-videók közül, névegyezés alapján (LLM nélkül). */
async function suggestReplacements(keywords: string[], exclude: string[]) {
  const terms = [...new Set(keywords.map((k) => k.trim()).filter((k) => k.length >= 4))].slice(0, 4);
  if (terms.length === 0) return [];
  return getDb()
    .select({ videoId: schema.podcastVideos.videoId, title: schema.podcastVideos.title, channelName: schema.podcastVideos.channelName })
    .from(schema.podcastVideos)
    .where(
      and(
        eq(schema.podcastVideos.reviewStatus, 'approved'),
        eq(schema.podcastVideos.viewThresholdMet, true),
        exclude.length > 0 ? notInArray(schema.podcastVideos.videoId, exclude) : undefined,
        or(...terms.map((t) => ilike(schema.podcastVideos.title, `%${t}%`))),
      ),
    )
    .orderBy(desc(schema.podcastVideos.publishedAt))
    .limit(2);
}

const yt = (id: string) => `https://youtu.be/${id}`;

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

  const uniqueIds = [...new Set(allRefs.map((r) => r.videoId))];
  if (uniqueIds.length === 0) return { checked: 0, broken: 0 };

  const { statuses, checked } = await step.run('fetch-youtube-statuses', () => fetchVideoStatuses(uniqueIds, apiKey));
  const unchecked = uniqueIds.length - checked.length;
  const broken = findBrokenVideos(allRefs, statuses, checked);
  if (broken.length === 0 && unchecked === 0) {
    logger?.info?.(`check-video-health: checked=${checked.length} broken=0`);
    return { checked: checked.length, broken: 0 };
  }

  const brokenIds = new Set(broken.map((b) => b.videoId));
  // Biztonsági zár: tömeges „hiány” inkább API-hiba, mint valóság.
  const suspicious = checked.length > 0 && broken.length / checked.length > MAX_AUTO_FIX_RATIO;

  const podcastBroken = broken.filter((b) => b.refs.some((r) => r.source === 'podcast'));
  const verdictBroken = broken.filter((b) => b.refs.some((r) => r.source === 'verdict'));

  let deletedPodcasts = 0;
  let clearedVerdicts = 0;
  if (!suspicious && (podcastBroken.length > 0 || verdictBroken.length > 0)) {
    const res = await step.run('auto-fix-db', async () => {
      const db = getDb();
      const podcastIds = podcastBroken.map((b) => b.videoId);
      const verdictIds = verdictBroken.map((b) => b.videoId);
      const del = podcastIds.length
        ? await db.delete(schema.podcastVideos).where(inArray(schema.podcastVideos.videoId, podcastIds)).returning({ id: schema.podcastVideos.videoId })
        : [];
      const upd = verdictIds.length
        ? await db.update(schema.courtVerdicts).set({ videoId: null }).where(inArray(schema.courtVerdicts.videoId, verdictIds)).returning({ id: schema.courtVerdicts.id })
        : [];
      return { deleted: del.length, cleared: upd.length };
    });
    deletedPodcasts = res.deleted;
    clearedVerdicts = res.cleared;
  }

  const manual = await step.run('build-manual-items', async () => {
    const items: string[] = [];
    for (const b of broken) {
      for (const r of b.refs.filter((x) => x.source === 'static')) {
        const where = r.path ? `${SITE}${r.path}` : 'nincs önálló oldala';
        const promo = promotionFor(r, brokenIds);
        let advice: string;
        if (promo && r.featured) {
          advice = `→ Előléptetés: „${promo.title}” (${yt(promo.videoId)}, most: ${promo.where}) legyen a kiemelt.`;
        } else if (promo) {
          advice = '→ Csere nem kell: az oldalon van több videó, ezt elég kivenni.';
        } else {
          const sugg = await suggestReplacements(r.keywords ?? [], [...brokenIds]);
          advice = sugg.length
            ? `→ Egyedüli videó volt. Cserejavaslat:\n${sugg.map((s) => `   – ${s.channelName}: „${s.title}” ${yt(s.videoId)}`).join('\n')}`
            : '→ Egyedüli videó volt; automatikus cserejavaslat nincs (nincs névegyező podcast-videó).';
        }
        items.push(`• ${r.label}\n  ${where}\n  Videó: ${yt(b.videoId)} — ${b.reason}\n  ${advice}`);
      }
    }
    return items;
  });

  await step.run('notify-broken-videos', async () => {
    const parts: string[] = [`🎬 ${broken.length} elérhetetlen YouTube-videó az oldalon.`];
    if (suspicious) {
      parts.push(`⚠️ Gyanúsan sok (${broken.length}/${checked.length}) — lehet, hogy a YouTube-lekérdezés hibázott, ezért most SEMMIT nem töröltem. Ha valós, szólj.`);
    }
    if (podcastBroken.length) {
      const lines = podcastBroken.map((b) => `• ${(b.refs.find((r) => r.source === 'podcast')?.label ?? b.videoId).replace(/^PODCAST: /, '')} — ${b.reason}`);
      parts.push(`${suspicious ? '🗂️ Podcast (NEM töröltem)' : `🗑️ Podcast — levéve az oldalról (${deletedPodcasts} sor törölve)`}:\n${lines.join('\n')}`);
    }
    if (verdictBroken.length) {
      const lines = verdictBroken.map(
        (b) => `• ${b.refs.filter((r) => r.source === 'verdict').map((r) => r.label.replace(/^BÍRÓSÁGI ÍTÉLET: /, '')).join(', ')} — ${b.reason}`,
      );
      parts.push(`${suspicious ? '⚖️ Ítélet-sor (NEM módosítva)' : `⚖️ Ítélet-sorról levéve a videó (${clearedVerdicts} sor)`}:\n${lines.join('\n')}`);
    }
    if (manual.length) parts.push(`✋ Kézi javítás kell (a kódban van — szólj Claude-nak):\n\n${manual.join('\n\n')}`);
    if (unchecked > 0) parts.push(`ℹ️ ${unchecked} videót nem sikerült lekérdezni a YouTube-tól — ezeket most kihagytam.`);
    let text = parts.join('\n\n');
    if (text.length > 4000) text = `${text.slice(0, 3950)}\n…(levágva)`;
    await sendTelegramMessage(text);
  });

  logger?.info?.(`check-video-health: checked=${checked.length} broken=${broken.length} deleted=${deletedPodcasts} cleared=${clearedVerdicts}`);
  return { checked: checked.length, broken: broken.length, deletedPodcasts, clearedVerdicts, manual: manual.length, suspicious };
}
