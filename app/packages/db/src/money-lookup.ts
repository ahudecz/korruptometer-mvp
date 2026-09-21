/**
 * ÖSSZEG-KERESÉS A CIKK TELJES SZÖVEGÉBŐL.
 *
 * User szabály, 2026-09-21: „olyan posztot ne gyárts, amiben nincs szám, hogy
 * majd én keresgéljem: nem fogom. … Ha vagyoni hátrányról, korrupcióról,
 * egyéb pénzügyi bűntényről van szó, akkor meg kéne fogni már ott, ha nincs
 * szám. Esetleg guglizz egy másik hírt."
 *
 * A KIVÁLTÓ ESET (2026-09-18, Duna Aszfalt): az `AssetRecovery` sor
 * `amountFt = 0` értékkel jött létre, és a poszt „0 Ft"-ot írt ki. Utólag
 * megmértem, hol van a szám:
 *
 *   - a forrás HVG-cikk címében és kivonatában:      NINCS
 *   - a saját cikk-adatbázisunkban (cím + kivonat):  NINCS
 *   - a 444 ugyanaznapi cikkének TELJES szövegében:  VAN — „126 milliárd forint”
 *
 * Vagyis a szám megvolt, csak senki nem olvasta el a cikk törzsét. A
 * NewsArticle tábla szándékosan nem tárol cikktörzset (alkotmány: a
 * `body` tárolását 2026-07-24-én vissza kellett vonni), de a
 * `fetchArticleBodyTransient()` tranziensen letöltheti — ezt a mintát a
 * detektorok már használják gyanú esetén.
 *
 * Ez a modul TISZTA: nincs benne hálózat és nincs benne DB. A hívó adja át a
 * szövegeket; így unit-tesztelhető, és a költség-kerettel sem kerül
 * kapcsolatba (nincs LLM-hívás).
 */

/** Ezres/tizedes elválasztók eltávolítása: „1 234,5" → 1234.5 */
function toNumber(raw: string): number {
  const cleaned = raw.replace(/[\s .]/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

const MULTIPLIER: Record<string, number> = {
  ezer: 1_000,
  millió: 1_000_000,
  millio: 1_000_000,
  milliárd: 1_000_000_000,
  milliard: 1_000_000_000,
  billió: 1_000_000_000_000,
  billio: 1_000_000_000_000,
};

export type MoneyHit = {
  /** Forintra váltott érték. */
  ft: number;
  /** A szövegbeli alak, ahogy megtaláltuk. */
  raw: string;
  /** Hol kezdődik a szövegben — a kulcsszó-közelség ehhez mérődik. */
  index: number;
};

/**
 * FORINT-összegek a szövegből. A devizás alakokat SZÁNDÉKOSAN kihagyjuk:
 * a Duna Aszfalt-cikkben ott volt egy „400 millió dollár" is, ami ugyanarról
 * az ügyletről szól, de forintként beírva nagyságrendi hiba lenne.
 */
export function parseHufAmounts(text: string): MoneyHit[] {
  const out: MoneyHit[] = [];
  if (!text) return out;
  const re =
    /(\d[\d\s .,]*)\s*(ezer|milli[óo]|milli[áa]rd|billi[óo])?\s*(forint[a-záéíóöőúüű]*|Ft)\b/giu;
  for (const m of text.matchAll(re)) {
    const value = toNumber(m[1] ?? '');
    if (!Number.isFinite(value) || value <= 0) continue;
    const unit = (m[2] ?? '').toLowerCase();
    const mult = unit ? (MULTIPLIER[unit] ?? 1) : 1;
    out.push({ ft: value * mult, raw: m[0].trim(), index: m.index ?? 0 });
  }
  return out;
}

/**
 * Kulcsszavak, amelyek KÖZELÉBEN a releváns összeg áll. A puszta „legnagyobb
 * szám" heurisztika téved: egy cikkben ott lehet a cég árbevétele, egy másik
 * ügy kára, vagy épp az útépítés teljes költsége.
 */
export const DAMAGE_KEYWORDS = [
  'vagyoni hátrány', 'vagyoni hatrany', 'kár', 'kart okoz', 'kárt okoz',
  'visszafizet', 'visszafizette', 'visszafizetés', 'megtérít',
  'elsikkaszt', 'eltulajdonít', 'megkárosít', 'hűtlen kezelés',
  'támogatás', 'közpénz', 'finanszírozás', 'kötvény', 'tőke',
] as const;

/** Legkisebb távolság a szövegben egy kulcsszó és az adott pozíció között. */
function distanceToKeyword(text: string, index: number, keywords: readonly string[]): number {
  const lower = text.toLowerCase();
  let best = Number.POSITIVE_INFINITY;
  for (const kw of keywords) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(kw, from);
      if (at === -1) break;
      best = Math.min(best, Math.abs(at - index));
      from = at + 1;
    }
  }
  return best;
}

export type AmountPick = { ft: number; raw: string; distance: number };

/**
 * A kulcsszavakhoz LEGKÖZELEBBI forintösszeg. `null`, ha nincs forintösszeg,
 * vagy ha egyik sem esik a megadott ablakon belülre — inkább ne adjunk
 * számot, mint rosszat.
 */
export function pickAmountNearKeywords(
  text: string,
  keywords: readonly string[] = DAMAGE_KEYWORDS,
  maxDistanceChars = 200,
): AmountPick | null {
  const hits = parseHufAmounts(text);
  if (hits.length === 0) return null;
  let best: AmountPick | null = null;
  for (const h of hits) {
    const d = distanceToKeyword(text, h.index, keywords);
    if (d > maxDistanceChars) continue;
    // Azonos távolságnál a NAGYOBB összeg nyer: a kár/visszafizetés
    // fő összege mellett gyakran ott áll egy részlet is.
    if (best === null || d < best.distance || (d === best.distance && h.ft > best.ft)) {
      best = { ft: h.ft, raw: h.raw, distance: d };
    }
  }
  return best;
}

export type SourceText = { url: string; text: string | null };

export type AmountLookupResult =
  | { found: true; ft: number; raw: string; url: string }
  | { found: false; triedUrls: string[] };

/**
 * MINDEN forrást végignéz, és a legnagyobb kulcsszó-közeli forintösszeget
 * adja vissza.
 *
 * Miért nem az első találat nyer — a valódi eseten mérve: a forrás HVG-cikk
 * csak a KAMATOT említi („több mint 10 milliárd forint kamattal együtt"), a
 * tőkét nem; a 126 milliárdos kötvényfinanszírozás csak a 444 cikkének
 * törzsében van meg. Az „első forrás nyer" szabály tehát a kamatot írta
 * volna be tőkeként: nagyságrendileg hihető, tartalmilag hamis szám.
 *
 * A „legnagyobb" nem vakmerő: a jelölteknek előbb át kell menniük a
 * kulcsszó-közelségi szűrőn, tehát egy cikkben szereplő árbevétel vagy egy
 * másik ügy kára eleve kiesik.
 */
export function lookupAmount(
  sources: readonly SourceText[],
  keywords: readonly string[] = DAMAGE_KEYWORDS,
): AmountLookupResult {
  const tried: string[] = [];
  let best: { ft: number; raw: string; url: string } | null = null;
  for (const s of sources) {
    tried.push(s.url);
    if (!s.text) continue;
    const pick = pickAmountNearKeywords(s.text, keywords);
    if (!pick) continue;
    if (best === null || pick.ft > best.ft) best = { ft: pick.ft, raw: pick.raw, url: s.url };
  }
  return best ? { found: true, ...best } : { found: false, triedUrls: tried };
}
