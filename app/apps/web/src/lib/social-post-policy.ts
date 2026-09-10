/**
 * A Facebook-posztok EGYETLEN kapuja és ütemezési szabályrendszere.
 *
 * 2026-09-10, user: „nemcsak javításokat akarok, hanem végleges fixet, hogy
 * ezek a jövőben ne történhessenek meg." Ezért a szabályok nem az egyes
 * builder-függvényekben szétszórva élnek (onnan egy ÚJ trigger-típus
 * bevezetésekor kimaradnának), hanem itt, tiszta függvényekben — a
 * check-social-triggers.ts pedig MINDEN jelöltet ezen enged át, közvetlenül
 * a beszúrás előtt. Ami itt megbukik, az nem kerül se Telegramra, se
 * Facebookra.
 *
 * A négy user-panasz, amit ez a modul szerkezetileg zár ki (2026-09-10):
 *  1. „minden nap az összesítő" → SUMMARY_COOLDOWN_DAYS + a napi rotációból
 *     kivéve (l. fallbackKindsForRun).
 *  2. „megint levágtad a szöveget a képen" → a kapu elutasít minden „…"-ra
 *     végződő vagy a képkorlátnál hosszabb kép-szöveget.
 *  3. „fiszem-faszom ügyek az adatbázisból" → bizonyított, legalább
 *     MIN_CASE_DAMAGE_FT érintettség + placeholder-summary tiltása.
 *  4. „egyszerre küldöd őket / egy perc alatt hármat" → MAX_PER_RUN és
 *     MIN_MINUTES_BETWEEN_POSTS (l. selectQueueBatch).
 */

import { IMAGE_DETAIL_MAX_CHARS } from './social-copy-variety';

/** Egy futásban legfeljebb ennyi jelölt mehet ki. */
export const MAX_PER_RUN = 1;

/** Két kiküldött jelölt között minimum ennyi idő teljen el. */
export const MIN_MINUTES_BETWEEN_POSTS = 120;

/** Az összesítő ("Eddig a Kegyencjáraton") legfeljebb ennyi naponta egyszer. */
export const SUMMARY_COOLDOWN_DAYS = 7;

/** Adatbázisból/ügykatalógusból felidézett ügy csak ekkora bizonyított
 *  érintettség fölött posztolható — user szabály, 2026-09-10:
 *  „Minimum 1 milliárdos érintettség legyen az alap, ami kikerülhet." */
export const MIN_CASE_DAMAGE_FT = 1_000_000_000n;

/**
 * Mennyi visszamenőleg számít „friss" eseménynek.
 *
 * 2026-09-10 gyökérok: itt korábban 2 óra volt, arra a feltevésre, hogy a
 * GitHub Actions cron ÓRÁNKÉNT lefut. A valóságban nem: 09-10-én egyetlen
 * futás volt egész nap (20:39), 09-09-én is csak néhány. Emiatt a 18:21-kor
 * rögzített Volánbusz-feljelentés — a nap egyetlen valódi eseménye — kiesett
 * a 2 órás ablakból, és helyette három tartalék-poszt ment ki. A dedup
 * amúgy is triggerRefId-alapú (alreadyPostedRefIds), tehát a hosszabb ablak
 * nem okoz ismétlést, viszont egy kimaradt cron-futás nem nyel el eseményt.
 */
export const EVENT_LOOKBACK_HOURS = 48;

/** Ezek a típusok VALÓDI esemény hatására keletkeznek — mindig előrébb
 *  valók, mint bármelyik tartalék („töltelék") típus. */
export const REAL_EVENT_TYPES = new Set([
  'complaint_milestone',
  'criminal_complaint',
  'resignation',
  'media_closure',
  'court_verdict',
  'court_verdict_update',
  'asset_recovery',
  'poll_final_result',
]);

/** Tartalék-típusok: nincs mögöttük friss esemény, csak a nap kitöltése. */
export type FallbackKind = 'catalog_highlight' | 'gallery_highlight' | 'summary_stats';

export type GateCandidate = {
  triggerType: string;
  headline: string;
  caption: string;
  /** A képre írt sor. summary_stats-nál JSON — azt a kapu nem szöveg-
   *  szabályok szerint nézi (l. isStructuredImageText). */
  imageText: string;
  /** Ügy-felidéző típusoknál a BIZONYÍTOTT érintettség forintban; null, ha
   *  nem sikerült megállapítani. Ilyenkor a jelölt elbukik — szándékosan:
   *  inkább ne menjen ki poszt, mint hogy egy ismeretlen súlyú ügy menjen. */
  provenAmountFt?: bigint | null;
};

export type GateResult = { ok: true } | { ok: false; reason: string };

/** A summary_stats kép-szövege JSON (címke/érték párok), nem mondat. */
function isStructuredImageText(triggerType: string): boolean {
  return triggerType === 'summary_stats';
}

/** Automatikusan generált katalógus-csonk, nem valódi ügyleírás — pl.
 *  „Fodor János — besorolatlan (1 cikk)". A ScandalCatalog 947 összefoglalója
 *  közül 673 ilyen (2026-09-10-i mérés), ezek sose mehetnek ki posztként. */
export function isPlaceholderSummary(text: string | null | undefined): boolean {
  const s = (text ?? '').trim();
  if (s.length === 0) return true;
  if (/besorolatlan/i.test(s)) return true;
  if (/\(\d+\s*cikk\)/i.test(s)) return true;
  return s.length < 120;
}

/**
 * Magyar, szabad szöveges összeg-címke ("~300 milliárd Ft", "2+ milliárd Ft
 * kenőpénz", "Több tízmilliárd Ft") felső korlátjának kinyerése forintban.
 * Nem talált/nem értelmezhető összegre null — a hívó ilyenkor NEM posztol.
 */
export function parseHungarianFtAmount(label: string | null | undefined): bigint | null {
  const s = (label ?? '').toLowerCase();
  if (!s.trim()) return null;

  // Az ELSŐ összeget vesszük, nem a legnagyobbat: a címke élén az ügy saját
  // kára áll, ami után gyakran jön egy összehasonlító szám is („~700 millió
  // Ft közkár — 3,5 Mrd Ft helyett 2,8 Mrd lett volna a piaci ár"). A
  // legnagyobbat választva ott 3,5 milliárdot állítanánk 700 millió helyett,
  // vagyis a szűrő átengedne egy 1 milliárd alatti ügyet.
  const AMOUNT_RE =
    /(?:([0-9]+(?:[.,][0-9]+)?)\s*\+?\s*|(tíz|húsz|harminc|ötven|száz)\s*)?(ezermilliárd|billió|milliárd|mrd\b|millió|m ft\b)/i;
  const m = AMOUNT_RE.exec(s);
  if (!m) return null;

  const UNIT_MULT: Record<string, bigint> = {
    ezermilliárd: 1_000_000_000_000n,
    billió: 1_000_000_000_000n,
    milliárd: 1_000_000_000n,
    mrd: 1_000_000_000n,
    millió: 1_000_000n,
    'm ft': 1_000_000n,
  };
  const unit = (m[3] ?? '').trim();
  const mult = UNIT_MULT[unit];
  if (mult === undefined) return null;

  if (m[1]) {
    const value = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return null;
    return BigInt(Math.round(value * Number(mult)));
  }

  const WORDS: Record<string, bigint> = { tíz: 10n, húsz: 20n, harminc: 30n, ötven: 50n, száz: 100n };
  const word = m[2];
  if (word && WORDS[word] !== undefined) return WORDS[word]! * mult;

  // Szám nélküli „milliárdos" — legalább egy egységnyi.
  return mult;
}

/**
 * A kapu. Minden jelölt ezen megy át közvetlenül a beszúrás előtt.
 */
export function checkPostGate(c: GateCandidate): GateResult {
  if (!c.headline.trim()) return { ok: false, reason: 'üres fejléc' };
  if (!c.caption.trim()) return { ok: false, reason: 'üres poszt-szöveg' };

  if (!isStructuredImageText(c.triggerType)) {
    const img = c.imageText.trim();
    // 2026-09-10 user report: „megint levágtad a szöveget a képen".
    if (/[…]|\.\.\.$/.test(img)) {
      return { ok: false, reason: 'a kép szövege csonkolt („…"-ra végződik)' };
    }
    if (img.length > IMAGE_DETAIL_MAX_CHARS) {
      return { ok: false, reason: `a kép szövege ${img.length} karakter, a korlát ${IMAGE_DETAIL_MAX_CHARS}` };
    }
    if (isPlaceholderSummary(c.caption)) {
      // a caption a teljes szöveg — ha AZ is csonk/placeholder, nincs mit posztolni
      if (/besorolatlan|\(\d+\s*cikk\)/i.test(c.caption)) {
        return { ok: false, reason: 'generált katalógus-csonk („besorolatlan" / „(N cikk)")' };
      }
    }
  }

  if (/[…]/.test(c.caption)) {
    return { ok: false, reason: 'a poszt szövege csonkolt („…") — a caption mindig teljes kell legyen' };
  }

  if (c.triggerType === 'catalog_highlight' || c.triggerType === 'gallery_highlight') {
    const amount = c.provenAmountFt ?? null;
    if (amount === null) return { ok: false, reason: 'nem bizonyítható az érintettség összege' };
    if (amount < MIN_CASE_DAMAGE_FT) {
      return { ok: false, reason: `érintettség ${amount} Ft < ${MIN_CASE_DAMAGE_FT} Ft minimum` };
    }
  }

  return { ok: true };
}

/**
 * Melyik tartalék-típusok jöhetnek szóba EBBEN a futásban.
 *
 * A summary_stats szándékosan NINCS a napi rotációban (user, 2026-09-10:
 * „Nem akarom minden nap a kibaszott összesítőt látni") — csak akkor, ha az
 * utolsó összesítő óta eltelt SUMMARY_COOLDOWN_DAYS nap, és akkor is a
 * sor VÉGÉN, tehát a két ügy-felidéző után.
 */
export function fallbackKindsForRun(opts: { now: Date; lastSummaryAt: Date | null }): FallbackKind[] {
  const base: FallbackKind[] = ['catalog_highlight', 'gallery_highlight'];
  const dayIndex = Math.floor(opts.now.getTime() / (24 * 60 * 60 * 1000)) % base.length;
  const rotated = [...base.slice(dayIndex), ...base.slice(0, dayIndex)];

  const cooldownMs = SUMMARY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const summaryDue = opts.lastSummaryAt === null || opts.now.getTime() - opts.lastSummaryAt.getTime() >= cooldownMs;
  return summaryDue ? [...rotated, 'summary_stats'] : rotated;
}

export type QueueDecision<T> = { selected: T[]; skippedReason?: string };

/**
 * Mennyi mehet ki MOST. Külön, tiszta függvény, hogy tesztelhető legyen a
 * DB nélkül — ez a „nem egy perc alatt hármat" szabály egyetlen helye.
 *
 * A jelölteket a hívó már fontossági sorrendben adja át (valódi események
 * elöl, tartalék hátul).
 */
export function selectQueueBatch<T>(
  candidates: T[],
  opts: { now: Date; lastQueuedAt: Date | null; remainingToday: number },
): QueueDecision<T> {
  if (candidates.length === 0) return { selected: [] };
  if (opts.remainingToday <= 0) return { selected: [], skippedReason: 'napi keret betelt' };

  if (opts.lastQueuedAt) {
    const minutes = (opts.now.getTime() - opts.lastQueuedAt.getTime()) / 60000;
    if (minutes < MIN_MINUTES_BETWEEN_POSTS) {
      return {
        selected: [],
        skippedReason: `az előző poszt ${Math.round(minutes)} perce ment ki, a minimum ${MIN_MINUTES_BETWEEN_POSTS} perc`,
      };
    }
  }

  return { selected: candidates.slice(0, Math.min(MAX_PER_RUN, opts.remainingToday)) };
}
