/**
 * Sablon-alapú (NEM LLM-generált) feliratszöveg a Social Post Outbox
 * posztjaihoz — user kérés, 2026-08-30. Szándékosan determinisztikus: a napi
 * $0,50-os Anthropic-keretet ez a funkció ne terhelje (l. feedback-llm-
 * cost-isolation memória).
 *
 * A szövegek KÖTELEZŐ forrása: docs/facebook-content-brief.md (user
 * utasítás, 2026-09-09: „csak ez alapján készülhet bármilyen poszt").
 */

import { WATCH_LIST } from '@app/_home/watchlist-config';

export function milestoneCaption(amountLabel: string): string {
  return [
    `🚨 Elérte a ${amountLabel}-ot a NER-hez és államigazgatáshoz köthető feltételezett bűncselekmények miatt tett feljelentések összértéke.`,
    '',
    'A fenti közpénz összegek a feljelentésekben megfogalmazott becslések, a tényleges vagyoni kár a bírósági eljárásokban szakértők által kerül megállapításra.',
    '',
    'Minden adat, forrás és részlet: kegyencjarat.hu/birosagi-iteletek',
    'Kattints és nézd meg, kik a legnagyobb feljelentők a kormány mellett!',
    '#kegyencjarat #korrupció #közpénz',
  ].join('\n');
}

// user kérés, 2026-09-03: minden posztba kell CTA (call-to-action) — a
// legtöbb típusnál egy általános "olvasd el a friss híreket"-féle sor, a
// szavazásnál viszont ("Szavazz te is!") a hívó (check-social-triggers.ts)
// felülírja explicit cta paraméterrel.
const DEFAULT_BREAKING_CTA = '👉 Kattints és olvasd el a legfrissebb híreket!';

// 2026-09-08 user brief (docs/facebook-content-brief.md 3. és 5. pont) — a
// Facebook-poszt legelső sora legyen MAGA a hook (a konkrét, tényszerű
// headline — pl. "Kirúgták X-et."), EGYETLEN funkcionális emojival, ne egy
// generikus "🚨 KICKER" all-caps felkiáltás. A kicker (kategória-szó) attól
// nem szűnt meg fontosnak lenni — az eseménytípusra utaló emoji ÉPPEN a
// kickerből dönt, csak nem íródik ki külön, dupla soron a kép-badge-en
// KÍVÜL is. Zárt lista, mert a brief konkrét emoji-t ír elő kategóriánként,
// nem "bármi odaillő"-t — ha egy kicker nincs a listán, a semleges 🚨 marad
// a fallback (pl. jövőbeli, még nem kategorizált trigger-típus).
const KICKER_EMOJI: Record<string, string> = {
  'LEMONDÁS': '👋',
  'KIRÚGÁS': '❌',
  'FELMENTÉS': '❌', // PoliticalResignation.resignationType='felmentés' — nem tévesztendő össze a CourtVerdict 'FELMENTVE' (felmentés a büntetőeljárásban) kickerrel lent.
  'VISSZAHÍVÁS': '❌',
  // Brief 11. pont — az őrizetbe vétel és az előzetes letartóztatás KÉT
  // KÜLÖN státusz. A CourtVerdict.verdictType a kettőt egy bucketbe teszi
  // ('előzetesben'), ezért az automata poszt azt a semlegesebb szót
  // használja; a kézi posztok viszont pontosan megnevezhetik, ha a forrás
  // egyértelmű ("őrizetbe vették").
  'ELŐZETESBEN': '🔴',
  'ŐRIZETBE VÉVE': '🔴',
  'LETARTÓZTATVA': '🔴', // bíróság által elrendelt letartóztatás — erősebb állítás, mint az őrizet: csak akkor, ha a forrás EZT írja
  'ÍTÉLET': '⚖️',
  'JOGERŐS ÍTÉLET': '⚖️',
  'VÁDEMELÉS': '📢',
  'SZABADLÁBON': '🔓',
  'ELJÁRÁS MEGSZŰNT': '⚪',
  'FELMENTVE': '✅',
  'VAGYONVISSZASZERZÉS': '💰',
  'FELJELENTÉS': '📄',
  'KVÍZ': '🧠',
  'MEGSZŰNÉS': '📉',
  'LEÉPÍTÉS': '📉',
  'ELMARADT ESEMÉNY': '📉',
  'MÉDIA-HÍR': '📰',
  'KIEMELT ÜGY': '🔎',
  'ADATBÁZIS': '🔎',
  'SZAVAZÁS EREDMÉNYE': '📊',
};

/**
 * headline = a hook — a konkrét, entitásra szabott sor (pl. "X: kirúgták!",
 * kvíznél a kvíz saját címe: "Lehetnél te az NVVH legfőbb ügyésze?") — ez
 * megy ki ELSŐ sorként, egyetlen kategória-emojival, nem egy külön
 * "🚨 KICKER" felkiáltással megelőzve (l. KICKER_EMOJI fenti komment).
 * hookLine = az opcionális, zéró-költségű "hangszín" mondat
 * (social-copy-variety.ts HOOKS), ami a hook UTÁN, kiegészítő energikus
 * sorként jöhet — sose helyettesíti, sose ismétli meg a hook-ot.
 */
/** A `/lemondasok/[id]` végoldal KIZÁRÓLAG a 8 WATCH_LIST-es tisztségviselőt
 *  ismeri (l. lemondasok/[id]/page.tsx generateStaticParams) — a
 *  PoliticalResignation UUID-ja ott GARANTÁLTAN 404. Ez élesben 2026-09-03 óta,
 *  a nem-watchlistes lemondások bekapcsolása óta MINDEN lemondás-poszton így
 *  volt (user report, 2026-09-11: „az összes telegramra küldött fb poszt
 *  linkje 404"). Ha a lemondó rajta van a watchlistán, az ő slugjára
 *  linkelünk, különben a mindig élő listaoldalra. SOSE a nyers r.id-t. */
function normalizeName(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').trim();
}

export function resignationLinkPath(name: string): string {
  const target = normalizeName(name);
  const hit = WATCH_LIST.find((p) => normalizeName(p.name) === target);
  return hit ? `/lemondasok/${hit.id}` : '/lemondasok';
}

/** Védőháló: nyers adatbázis-UUID SOSE kerülhet a poszt linkjébe. A
 *  /lemondasok/[id] (és a többi végoldal) slugot vár, nem UUID-t — a nyers
 *  id garantált 404 (user report, 2026-09-11: „az összes telegramra küldött
 *  fb poszt linkje 404"). Itt inkább a szülő listaoldalra esünk vissza, mint
 *  hogy döglött linket posztoljunk. */
const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/i;

export function safeLinkPath(linkPath?: string): string {
  if (!linkPath) return '';
  return UUID_SEGMENT.test(linkPath) ? linkPath.replace(UUID_SEGMENT, '') : linkPath;
}

export function breakingCaption(kicker: string, headline: string, detail?: string, linkPath?: string, cta: string = DEFAULT_BREAKING_CTA, hookLine?: string): string {
  const emoji = KICKER_EMOJI[kicker] ?? '🚨';
  // "Blokkokban" épül (hook+hookLine együtt, a detail önállóan, a lábjegyzet
  // önállóan), a blokkok közé egy-egy üres sor kerül — így egy hiányzó
  // detail sosem hagy két egymást követő üres sort (mint egy fix-pozíciós
  // '' placeholderes tömb tenné). l. brief 4. pont (mobilon olvasható
  // tagolás, nincs szövegfal).
  const top = [`${emoji} ${headline}`, hookLine ?? null].filter((l): l is string => l !== null);
  const footer = [`Részletek: kegyencjarat.hu${safeLinkPath(linkPath)}`, cta, '#kegyencjarat #korrupció'];
  const blocks = [top.join('\n'), ...(detail ? [detail] : []), footer.join('\n')];
  return blocks.join('\n\n');
}

// Napi tartalék-poszt (nincs elég friss esemény aznapra) — futó összesítő
// számok, mindig kegyencjarat.hu-s linkkel. l. check-social-triggers.ts
// buildSummaryStatsTrigger.
export function summaryCaption(lines: string[], linkPath: string, cta: string = '👉 Nézd meg a teljes adatbázist!'): string {
  return [
    '📊 EDDIG A KEGYENCJÁRATON',
    '',
    ...lines,
    '',
    `Minden adat, forrás és részlet: kegyencjarat.hu${safeLinkPath(linkPath)}`,
    cta,
    '#kegyencjarat #korrupció',
  ].join('\n');
}
