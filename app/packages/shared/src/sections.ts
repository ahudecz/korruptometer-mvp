/**
 * 012-reader-subscriptions — a hat feliratkozási szekció EGYETLEN forrása (FR-007).
 *
 * Innen származik a Drizzle/pg enum tagsora, a zod-séma, az űrlap jelölőnégyzetei
 * és a szekció→oldal térkép. Máshol egyetlen fájl sem írhatja le betűszerint egy
 * szekció nevét.
 *
 * Miért `@korr/shared` és nem `@korr/db`: a feliratkozó űrlap `'use client'`,
 * a `@korr/db` belépési pontja viszont a Drizzle-kliens — az nem mehet böngészőbe.
 *
 * A tagok sorrendje a TÁROLÁSI sorrend (a pg enum sorrendje). NEM ábécérend.
 */

export const SUBSCRIPTION_SECTIONS = [
  'resignation',
  'media_closure',
  'court_verdict',
  'criminal_complaint',
  'asset_recovery',
  'watchlist_removal',
] as const;

export type SubscriptionSection = (typeof SUBSCRIPTION_SECTIONS)[number];

export function isSubscriptionSection(value: unknown): value is SubscriptionSection {
  return typeof value === 'string' && (SUBSCRIPTION_SECTIONS as readonly string[]).includes(value);
}

/**
 * OLVASÓNAK szóló magyar szekciónevek. A két szerkesztői címketérkép
 * (`TARGET_LABELS_HU`, `DETECTOR_LABELS_HU`) NEM ebből származik (FR-009): a
 * szövegük más, és az újraszármaztatás csendben átírná az élő szerkesztői
 * értesítéseket egy hírlevél-feature mellékhatásaként.
 */
export const SECTION_LABELS_HU: Record<SubscriptionSection, string> = {
  resignation: 'Lemondások és kirúgások',
  media_closure: 'Megszűnt médiumok',
  court_verdict: 'Bírósági ítéletek',
  criminal_complaint: 'Feljelentések',
  asset_recovery: 'Visszaszerzett vagyon',
  watchlist_removal: 'Tisztségviselő-eltávolítások',
};

/**
 * Szekció → oldal (FR-030). Csak a `resignation` alá tartozik részletes
 * aloldal; a többi öt a saját listaoldalára mutat, ahol van, ott horgonnyal.
 *
 * A `/birosagi-iteletek` egyetlen horgonyt visel, az ítélet-szekción — a
 * feljelentések ugyanazon az oldalon, külön horgony nélkül vannak, ezért az
 * üzenet SZÖVEGÉNEK kell megmondania, melyikről van szó (FR-031).
 */
export const SECTION_URLS: Record<SubscriptionSection, string> = {
  resignation: '/lemondasok',
  media_closure: '/megszunt',
  court_verdict: '/birosagi-iteletek#birosagi-iteletek',
  criminal_complaint: '/birosagi-iteletek',
  asset_recovery: '/visszaszerzett-vagyon',
  watchlist_removal: '/lemondosok',
};

/**
 * A megjelenített hozzájárulási szöveg verziója. A `Subscriber.consentTextVersion`
 * oszlopba kerül, és TÚLÉLI a megőrzési söprést — ez a GDPR 7. cikk (1) szerinti
 * bizonyíték arra, MIRE mondott igent az olvasó (FR-083, FR-086).
 */
export const CONSENT_TEXT_VERSION = '2026-09-01';
