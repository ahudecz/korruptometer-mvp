import { PERSON_ROLLUPS } from './person-rollup-config';
import { liveFeltarok } from './rendszervaltas-config';

/**
 * AUTOMATIKUS BELSŐ NÉVLINKELÉS.
 *
 * User, 2026-09-17: „Szíjjnak van egy adatbázisos oldala, amikor ilyen név
 * merül fel, akkor odalinkelj, ez SEO szempontból alap. Nézd át az összes
 * tartalmat és ahol adatbázisos vagy kiemelt személyek nevei merülnek fel,
 * akiknek van saját oldaluk, tegyetek a névre belső linket."
 *
 * Miért így, és nem kézzel: a Dicsőségfal szövegei egy configban élnek, és
 * folyamatosan bővülnek. Ha minden egyes bekezdéshez kézzel kellene
 * `links`-et írni, az első elfelejtett névnél szétcsúszik — és pont az új
 * tartalmaknál csúszna szét, ahol a legtöbbet érne. Ez a modul a
 * RENDERELÉSKOR köti be a neveket, tehát minden meglévő és minden jövőbeli
 * szövegre egyszerre érvényes.
 *
 * A névlista forrása a `PERSON_ROLLUPS` — pontosan azok a személyek, akiknek
 * van saját `/adatbazis/szemely/<slug>` oldaluk. Nincs külön karbantartandó
 * lista: ha valaki bekerül a rollupba, innentől automatikusan linkelődik is.
 *
 * Három szabály védi a szöveget a túl-linkeléstől és a rossz találatoktól:
 *
 *  1. OLDALANKÉNT EGYSZER. A hívó egy `Set`-et ad át, ami végigkíséri az
 *     oldal renderelését; egy név csak az első előfordulásánál lesz link.
 *     Tíz Mészáros-link egy oldalon nem SEO, hanem spam.
 *  2. CSAK TELJES NÉV, RAGGAL EGYÜTT. A minta a teljes „Vezetéknév Keresztnév"
 *     alakra illeszt, és megengedi a magyar toldalékot („Szíjj Lászlóval"),
 *     de szó közepére sosem talál rá.
 *  3. A KÉZI LINK ELŐBBRE VALÓ. Ez a függvény csak azokon a szöveg-
 *     darabokon fut, amelyek az explicit `links` feldolgozása után maradtak,
 *     így egy kézzel megadott hivatkozást sosem ír felül, és linkbe ágyazott
 *     linket sem gyárt.
 */

export type PersonLink = {
  name: string;
  href: string;
  pattern: RegExp;
  /**
   * Szövegrészek, amelyek után a találat NEM linkelhető. Egyetlen oka van, és
   * az nem elméleti: a „Juhász Péter" (a Dicsőségfalon szereplő videós) teljes
   * egészében benne van a „Juhász Péter Pál" névben (a Szőlő utcai ügy volt
   * igazgatója). A toldalék-lookahead ezt nem fogja meg, mert a kettő közt
   * szóköz áll — szóköz pedig nem szókarakter. Enélkül minden Szőlő utcai
   * bekezdésben egy ártatlan újságíró nevére mutatna a link.
   */
  notFollowedBy?: string[];
};

/** Ékezetes betűk is szókaraktereknek számítanak a toldalék-illesztésnél. */
const WORD_CHAR = 'A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű0-9';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function namePattern(name: string): RegExp {
  return new RegExp(
    `(?<![${WORD_CHAR}])(${escapeRegExp(name)}[${WORD_CHAR}]{0,6})(?![${WORD_CHAR}])`,
    'g',
  );
}

/** NER-szereplők → a saját „összes ügye" rollup oldaluk. */
const ROLLUP_LINKS: PersonLink[] = PERSON_ROLLUPS.map((p) => ({
  name: p.personName,
  href: `/adatbazis/szemely/${p.slug}`,
  pattern: namePattern(p.personName),
}));

/**
 * FELTÁRÓK → a Dicsőségfal saját profiloldaluk (/rendszervaltas/<id>).
 *
 * User, 2026-09-22: „minden név szerinti konkrét egyezéses említésnél menjen a
 * hivatkozás, hogy a SEO-t segítsük" — tehát ha egy ügyoldal szövegében az
 * szerepel, hogy egy ügyet Hadházy Ákos vagy Juhász Péter tárt fel, arra
 * mutasson link.
 *
 * Csak az ÉLŐ profilok kerülnek bele: egy `live: false` feltáró oldala
 * `notFound()`-ot ad, tehát a link 404 lenne. Amint valakinek elkészül a
 * végoldala, ez a lista magától bővül — nincs külön karbantartandó névsor.
 */
const FELTARO_LINKS: PersonLink[] = liveFeltarok().map((f) => ({
  name: f.name,
  href: `/rendszervaltas/${f.id}`,
  pattern: namePattern(f.name),
  notFollowedBy: f.id === 'juhasz-peter' ? [' Pál'] : undefined,
}));

/**
 * A hosszabb nevek elöl: ha egy szöveg egyszerre tartalmazza a „Szíjj László"
 * és a „Szíjj" alakot, a hosszabbra kell illeszteni előbb. (A rollupban ma
 * csak teljes nevek vannak, de a sorrend garancia, nem feltételezés.)
 */
export const PERSON_LINKS: PersonLink[] = [...ROLLUP_LINKS, ...FELTARO_LINKS].sort(
  (a, b) => b.name.length - a.name.length,
);

export type PersonMatch = {
  before: string;
  matched: string;
  after: string;
  href: string;
  name: string;
};

/**
 * A minta első olyan találata, amit nem tilt ki a `notFollowedBy`. Azért kell
 * végigjárni a találatokat, mert egy bekezdésben szerepelhet előbb a tiltott
 * („Juhász Péter Pál"), utána a valódi („Juhász Péter") alak — az elsőnél
 * megállva a másodikat sosem találnánk meg.
 *
 * A `pattern` globális, ezért a `lastIndex`-et minden híváskor nullázni kell:
 * enélkül a következő bekezdés keresése ott folytatódna, ahol az előző
 * abbamaradt, és a szöveg eleji neveket átugraná.
 */
function firstAllowedMatch(link: PersonLink, text: string): RegExpExecArray | null {
  link.pattern.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = link.pattern.exec(text)) !== null) {
    const after = text.slice(m.index + m[1]!.length);
    if (!link.notFollowedBy?.some((deny) => after.startsWith(deny))) return m;
    // Végtelen ciklus elleni védelem nulla hosszú illeszkedésnél.
    if (m.index === link.pattern.lastIndex) link.pattern.lastIndex += 1;
  }
  return null;
}

/**
 * Mely nevek fordulnak elő a megadott szövegekben — linkelés nélkül, csak
 * felderítés.
 *
 * Azért van rá szükség, mert egy oldalon egy név csak EGYSZER lehet link, és
 * nem mindegy, hol. Egy ügyoldalon a videó forrás-címkéje („HADHÁZY ÁKOS")
 * hamarabb áll a DOM-ban, mint az ismertető szövege („Hadházy Ákos
 * feljelentése nyomán…") — pedig SEO-ból a mondatba ágyazott név ér többet.
 * A hívó ezzel előre kiszedi a szövegekben szereplő neveket, és a címkéknél
 * ezeket kihagyja: így a link mindig a prózában köt ki.
 */
export function namesInTexts(texts: (string | null | undefined)[]): Set<string> {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const link of PERSON_LINKS) {
      if (found.has(link.name)) continue;
      if (firstAllowedMatch(link, text)) found.add(link.name);
    }
  }
  return found;
}

/**
 * Megkeresi a szöveg ELSŐ olyan személynevét, amelyik még nem volt linkelve
 * ezen az oldalon. Ha nincs ilyen, `null`.
 *
 * Szándékosan darabonként egy találatot ad vissza: a hívó a maradékon
 * újrahívja, így egy bekezdésben több különböző név is linkelődhet, de
 * ugyanaz a név nem kétszer.
 */
export function findPersonLink(
  text: string,
  alreadyLinked: Set<string>,
  /** A RENDERELT oldal saját útvonala — önmagára egyetlen lap sem linkel. */
  skipHref?: string,
): PersonMatch | null {
  let best: (PersonMatch & { index: number }) | null = null;
  for (const link of PERSON_LINKS) {
    if (alreadyLinked.has(link.name)) continue;
    if (skipHref && link.href === skipHref) continue;
    const m = firstAllowedMatch(link, text);
    if (!m || m.index === undefined) continue;
    // A szövegben előrébb álló név nyer, hogy a bekezdés olvasási sorrendjét
    // kövessük, ne a névlista sorrendjét.
    if (best === null || m.index < best.index) {
      best = {
        index: m.index,
        before: text.slice(0, m.index),
        matched: m[1]!,
        after: text.slice(m.index + m[1]!.length),
        href: link.href,
        name: link.name,
      };
    }
  }
  if (!best) return null;
  const { index: _index, ...rest } = best;
  return rest;
}
