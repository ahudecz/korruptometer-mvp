import 'server-only';
import { isBreaking } from '@korr/scrapers';

export interface RankablePodcastVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: Date;
  viewCount: number | null;
  pinnedUntil: Date | null;
}

function isPinned(v: RankablePodcastVideo, now: number): boolean {
  return v.pinnedUntil != null && v.pinnedUntil.getTime() > now;
}

/** Nézettség/óra a feltöltés óta — nem a nyers nézettség, hogy egy régi,
 *  sokat nézett videó ne ragadjon örökre a lista tetején egy most felfutó
 *  darabbal szemben. */
function velocity(v: RankablePodcastVideo, now: number): number {
  if (!v.viewCount) return 0;
  const hours = Math.max(1, (now - v.publishedAt.getTime()) / 3_600_000);
  return v.viewCount / hours;
}

/**
 * Rangsor a /podcastok kiemelés-választáshoz (2026-07-26, user jóváhagyással):
 *   1. kézi pin (pinnedUntil a jövőben) — szerkesztői vétó, mindig felülír
 *   2. "breaking" találat (isBreaking() — figyelt személy + sürgősségi
 *      kulcsszó a címben) — nem kell megvárni, hogy felfusson a nézettsége
 *   3. nézettségi sebesség (l. velocity())
 *   4. friss dátum
 *
 * A pozíció dönti el a megjelenítést a lapon — nincs külön logika a nyitó
 * spotlightra és a rács közti spotlight-sávokra, csak egy rangsor, amit a
 * sablon tördel szét (podcastok/page.tsx buildBlocks()).
 */
export function rankPodcastVideos<T extends RankablePodcastVideo>(
  videos: T[],
  monitoredNames: readonly string[],
): T[] {
  const now = Date.now();
  return [...videos].sort((a, b) => {
    const aPinned = isPinned(a, now);
    const bPinned = isPinned(b, now);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    const aBreaking = isBreaking(a.title, a.description, monitoredNames);
    const bBreaking = isBreaking(b.title, b.description, monitoredNames);
    if (aBreaking !== bBreaking) return aBreaking ? -1 : 1;

    const aVel = velocity(a, now);
    const bVel = velocity(b, now);
    if (aVel !== bVel) return bVel - aVel;

    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });
}
