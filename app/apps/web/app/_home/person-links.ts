import { PERSON_ROLLUPS } from './person-rollup-config';

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

export type PersonLink = { name: string; href: string; pattern: RegExp };

/** Ékezetes betűk is szókaraktereknek számítanak a toldalék-illesztésnél. */
const WORD_CHAR = 'A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű0-9';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A hosszabb nevek elöl: ha egy szöveg egyszerre tartalmazza a „Szíjj László"
 * és a „Szíjj" alakot, a hosszabbra kell illeszteni előbb. (A rollupban ma
 * csak teljes nevek vannak, de a sorrend garancia, nem feltételezés.)
 */
export const PERSON_LINKS: PersonLink[] = PERSON_ROLLUPS.map((p) => ({
  name: p.personName,
  href: `/adatbazis/szemely/${p.slug}`,
  pattern: new RegExp(
    `(?<![${WORD_CHAR}])(${escapeRegExp(p.personName)}[${WORD_CHAR}]{0,6})(?![${WORD_CHAR}])`,
  ),
}))
  .sort((a, b) => b.name.length - a.name.length);

export type PersonMatch = {
  before: string;
  matched: string;
  after: string;
  href: string;
  name: string;
};

/**
 * Megkeresi a szöveg ELSŐ olyan személynevét, amelyik még nem volt linkelve
 * ezen az oldalon. Ha nincs ilyen, `null`.
 *
 * Szándékosan darabonként egy találatot ad vissza: a hívó a maradékon
 * újrahívja, így egy bekezdésben több különböző név is linkelődhet, de
 * ugyanaz a név nem kétszer.
 */
export function findPersonLink(text: string, alreadyLinked: Set<string>): PersonMatch | null {
  let best: (PersonMatch & { index: number }) | null = null;
  for (const link of PERSON_LINKS) {
    if (alreadyLinked.has(link.name)) continue;
    const m = link.pattern.exec(text);
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
