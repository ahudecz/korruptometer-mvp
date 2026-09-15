import { isFacebookVideoUrl } from '@korr/shared/facebook-reel';

import { MAX_REELS_PER_AUTHOR, REEL_SECTION_LIMIT } from './reels-config';

export type ReelRow = {
  id: string;
  authorName: string;
  postUrl: string;
  imageUrl: string | null;
  content: string | null;
  postedAt: Date | string | null;
};

/**
 * A kurált reel-szekció kiválasztása.
 *
 * A bemenet már szűrt (csak a REEL_AUTHORS szerzői, frissesség szerint
 * rendezve) — itt három szabály dől el:
 *
 * 1. Csak lejátszható sor jöhet szóba. A nem videó-permalinket itt dobjuk
 *    el, nem a megjelenítésnél, különben beszámítana a kvótába és üres
 *    helyet hagyna a rácsban.
 * 2. Szerzőnként legfeljebb MAX_REELS_PER_AUTHOR, összesen legfeljebb
 *    REEL_SECTION_LIMIT. Egy szerző napi 5 reelje különben elnyelné az
 *    egész szekciót (ugyanaz a "max 1 videó/csatorna" szabály, mint a
 *    podcast-rácsnál).
 * 3. A frissesség MINDIG nyer, a hiányzó poszterkép nem szempont. Ezt
 *    2026-09-15-én egyszer megpróbáltuk fordítva (a képes sort előnyben
 *    részesíteni), és mérve rossz volt: a szinkronból épp a legutóbbi
 *    hetek reeljeinél hiányzik a thumbnail, így a rács 2 hónapos videókra
 *    cserélte a hetes friss tartalmat. Kép helyett ezért a lejátszó
 *    placeholderje lett rendesen megcsinálva (fb-reel-embed.tsx).
 */
export function pickReels(rows: ReelRow[]): ReelRow[] {
  const playable = rows.filter((r) => isFacebookVideoUrl(r.postUrl));

  const perAuthor = new Map<string, number>();
  const picked: ReelRow[] = [];
  for (const row of playable) {
    if (picked.length >= REEL_SECTION_LIMIT) break;
    const used = perAuthor.get(row.authorName) ?? 0;
    if (used >= MAX_REELS_PER_AUTHOR) continue;
    perAuthor.set(row.authorName, used + 1);
    picked.push(row);
  }
  return picked;
}
