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

  // MINDEN JEL ELŐRE KISZÁMOLVA, nem a komparátorban.
  //
  // A komparátor eddig minden összehasonlításnál KÉT isBreaking()-hívást
  // végzett, ami a videó címét és leírását kisbetűsíti, majd a figyelt
  // nevekre (élesben 582 db) keres benne. 828 videónál ez mérve 2020 hívás
  // és 60 ms; előre számolva 828 hívás és 30 ms. A sorrend VÁLTOZATLAN:
  // ugyanazokat a jeleket ugyanabban a prioritásban használja, csak nem
  // számolja újra őket összehasonlításonként.
  //
  // Megjegyzés a méretarányról: ez önmagában NEM magyarázza a 2026-09-17-i
  // elhasalt buildeket — a teljes /podcastok adatlekérés + rangsorolás
  // európai gépről mérve 0,9 másodperc (578 ms videó-lekérdezés, 327 ms
  // getMonitoredNames, 13 ms rangsorolás). A build-időtúllépés oka a
  // kapcsolat-pool szűkössége volt, l. lib/db.ts. Ez itt tiszta nyereség,
  // nem a hiba javítása.
  const rank = new Map<T, { pinned: boolean; breaking: boolean; vel: number; published: number }>();
  for (const v of videos) {
    rank.set(v, {
      pinned: isPinned(v, now),
      breaking: isBreaking(v.title, v.description, monitoredNames),
      vel: velocity(v, now),
      published: v.publishedAt.getTime(),
    });
  }

  return [...videos].sort((a, b) => {
    const x = rank.get(a)!;
    const y = rank.get(b)!;
    if (x.pinned !== y.pinned) return x.pinned ? -1 : 1;
    if (x.breaking !== y.breaking) return x.breaking ? -1 : 1;
    if (x.vel !== y.vel) return y.vel - x.vel;
    return y.published - x.published;
  });
}
