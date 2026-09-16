/**
 * Közös válogató a Facebook-feedhez (nyitóoldali teaser + /legfontosabb-hangok).
 *
 * User kérés (2026-09-16): „nem lehet, hogy időrendi sorrendben vannak kinn a
 * posztok… valaki 20-at posztol egy nap, valaki meg kétnaponta, akkor ne az a
 * húsz poszt legyen ott, hanem mindenkitől 1-2, de azok időrendben, a
 * legfrissebb legyen a legelső."
 *
 * Két dolgot old meg együtt:
 *
 *  1. RENDEZÉS a valódi megjelenési idő (`postedAt`) szerint, nem a beolvasás
 *     ideje (`createdAt`) szerint. Egy szinkronfutás minden sora ugyanabban a
 *     percben készül, így a `createdAt`-rendezés valójában a scrape sorrendjét
 *     mutatta — ezért ült három oldal a lista tetején.
 *
 *  2. SZERZŐNKÉNTI KORLÁT: az első körben oldalanként legfeljebb `perAuthor`
 *     poszt (a legfrissebbek). A korlát fölötti posztok nem vesznek el, csak
 *     hátrébb kerülnek — így a „Több poszt" gomb alatt továbbra is ott a teljes
 *     archívum, szintén időrendben.
 */

export type FeedPost = {
  authorName?: string | null;
  authorHandle?: string | null;
  postedAt?: string | null;
  createdAt?: string | null;
  [key: string]: unknown;
};

/** A rendezéshez használt időpont: a valódi megjelenés, ha ismert. */
export function feedTime(p: FeedPost): number {
  const t = p.postedAt ?? p.createdAt;
  const ms = t ? Date.parse(String(t)) : NaN;
  // Az időpont nélküli (régi, Apify-os) sorok a lista végére kerülnek.
  return Number.isNaN(ms) ? 0 : ms;
}

// Ugyanaz az oldal többféle néven is szerepel a táblában, mert az évek során
// három különböző forrásból töltöttük (Apify, Make.com, saját szinkron):
// „Magyar Péter" / „Péter Magyar", „Kulja András" / „Dr. Kulja András",
// „Bódis Kriszta" / „Bódis Kriszta public", és a Vidéki Prókátor sorainak fele
// authorHandle nélkül van. Ha ezeket külön szerzőnek vennénk, ugyanaz az oldal
// duplán merítené ki a keretét.
const NOISE_TOKENS = new Set(['dr', 'public', 'official', 'hu', 'tisza']);

export function authorKey(p: FeedPost): string {
  const raw = String(p.authorName ?? p.authorHandle ?? '?');
  const tokens = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !NOISE_TOKENS.has(t))
    // A név sorrendje forrásonként eltér (vezetéknév elöl vagy hátul), ezért
    // rendezve fűzzük össze.
    .sort();
  return tokens.length ? tokens.join('-') : raw.toLowerCase();
}

/**
 * Időrendbe rakja a posztokat úgy, hogy előre kerül minden oldal legfrissebb
 * `perAuthor` posztja, és csak utánuk jön a többi (szintén időrendben).
 */
export function orderFeed<T extends FeedPost>(pool: T[], perAuthor = 2): T[] {
  const sorted = [...pool].sort((a, b) => feedTime(b) - feedTime(a));
  const count = new Map<string, number>();
  const front: T[] = [];
  const rest: T[] = [];
  for (const post of sorted) {
    const key = authorKey(post);
    const n = count.get(key) ?? 0;
    count.set(key, n + 1);
    (n < perAuthor ? front : rest).push(post);
  }
  return [...front, ...rest];
}

/** Az első `limit` poszt a fenti sorrendből (nyitóoldali teaser). */
export function pickDiverse<T extends FeedPost>(
  pool: T[],
  { perAuthor = 1, limit = 18 }: { perAuthor?: number; limit?: number } = {},
): T[] {
  const sorted = [...pool].sort((a, b) => feedTime(b) - feedTime(a));
  const count = new Map<string, number>();
  const out: T[] = [];
  for (const post of sorted) {
    const key = authorKey(post);
    const n = count.get(key) ?? 0;
    if (n >= perAuthor) continue;
    count.set(key, n + 1);
    out.push(post);
    if (out.length >= limit) break;
  }
  return out;
}
