/**
 * „Ezeket az ügyeket is érdemes elolvasni" — ajánló-kiválasztás.
 *
 * 2026-09-29 Search Console-audit: a sitemap 1040 URL-jéből 614 nincs
 * indexelve, és ebből 594 egy-egy /adatbazis/<ügy> végoldal. Nem hibásak —
 * a Google nem talál el hozzájuk, mert szinte semmi nem linkel rájuk (a
 * „Kapcsolódó ügyek" blokk csak közös személynél/intézménynél jelenik meg,
 * és az ügyek nagy részének nincs ilyen párja).
 *
 * Két rétegből áll a kiválasztás:
 *  1. **Gyűrű** — az ügyek stabil (id szerinti) sorrendjében minden ügyoldal a
 *     következő RING_SIZE ügyre linkel. Így garantáltan MINDEN ügyre mutat
 *     legalább egy belső link, és a robot a láncon végig tud menni.
 *  2. **Heti rotáció** — a többi hely determinisztikusan véletlenszerű, a
 *     seed = oldalkulcs + hét. Egy héten belül ugyanaz az oldal ugyanazt
 *     mutatja (a robot nem lát ugráló tartalmat), hétről hétre viszont más
 *     ügyek kapnak linket.
 *
 * Tiszta függvény, DB nélkül — a teszt ezt ellenőrzi.
 */

export type RecCase = {
  id: string;
  name: string;
  person: string | null;
  institution: string | null;
  damageHuf: string;
  articleCount: number;
};

export const RING_SIZE = 3;

/**
 * 2026-09-29, user: „ajánlóban nem lehet olyan ügy, ami 1 cikkre épül."
 * Az egycikkes ügyek jó része gépi félreolvasás (pl. egy általános
 * NER-milliárdos cikkből gyártott „Varga Judit Mydent" ügy) — ezeket nem
 * tolhatjuk a látogató elé, amíg nincsenek kézzel ellenőrizve.
 */
export const MIN_RECOMMEND_ARTICLES = 2;

/** 2026-09-29, user: az ajánlóba kerülés alsó értékhatára 500 millió Ft. */
export const MIN_RECOMMEND_DAMAGE_HUF = 500_000_000n;

export function isRecommendable(c: Pick<RecCase, 'articleCount' | 'damageHuf'>): boolean {
  let damage = 0n;
  try {
    damage = BigInt(c.damageHuf);
  } catch {
    return false;
  }
  return c.articleCount >= MIN_RECOMMEND_ARTICLES && damage >= MIN_RECOMMEND_DAMAGE_HUF;
}

/** FNV-1a 32 bites hash — stabil seed stringből. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — kicsi, determinisztikus PRNG. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ISO-hét azonosító (pl. "2026-W40") — a rotáció kulcsa. */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function pickRecommendations(
  pool: readonly RecCase[],
  opts: {
    /** Az aktuális ügyoldal id-je — ha az ügy benne van a poolban, a gyűrű innen indul. */
    currentId?: string | null;
    /** Oldalkulcs a rotációhoz (pl. az útvonal). */
    pageKey: string;
    /** Rotációs kulcs, jellemzően isoWeekKey(new Date()). */
    rotation: string;
    count?: number;
    /** Már máshol linkelt ügyek (pl. „Kapcsolódó ügyek") — ne ismételjük. */
    excludeIds?: readonly string[];
  },
): RecCase[] {
  const count = opts.count ?? 6;
  const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const excluded = new Set(opts.excludeIds ?? []);
  if (opts.currentId) excluded.add(opts.currentId);

  const picked: RecCase[] = [];
  const taken = new Set<string>();
  const take = (c: RecCase | undefined) => {
    if (!c || picked.length >= count || taken.has(c.id) || excluded.has(c.id)) return;
    picked.push(c);
    taken.add(c.id);
  };

  // 1. Gyűrű: a következő RING_SIZE ügy. A gyűrű-szomszédot akkor is
  //    felvesszük, ha a „Kapcsolódó ügyek" már linkeli — a garancia a
  //    lényeg, nem a duplikáció elkerülése —, de önmagát sosem.
  const idx = opts.currentId ? sorted.findIndex((c) => c.id === opts.currentId) : -1;
  if (idx >= 0 && sorted.length > 1) {
    for (let k = 1; k <= Math.min(RING_SIZE, sorted.length - 1); k++) {
      const c = sorted[(idx + k) % sorted.length];
      if (c && !taken.has(c.id) && picked.length < count) {
        picked.push(c);
        taken.add(c.id);
      }
    }
  }

  // 2. Heti rotáció: seedelt Fisher–Yates a maradékon.
  const rest = sorted.filter((c) => !taken.has(c.id) && !excluded.has(c.id));
  const rand = rng(hash(`${opts.pageKey}|${opts.rotation}`));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  for (const c of rest) {
    if (picked.length >= count) break;
    take(c);
  }
  return picked;
}
