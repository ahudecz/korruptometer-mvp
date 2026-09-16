/**
 * Sablon-alapú (NEM LLM-generált) feliratszöveg a Social Post Outbox
 * posztjaihoz — user kérés, 2026-08-30. Szándékosan determinisztikus: a napi
 * $0,50-os Anthropic-keretet ez a funkció ne terhelje (l. feedback-llm-
 * cost-isolation memória), és a user 2026-09-07-én kifejezetten NEMET mondott
 * egy fizetős LLM-hívásra poszt-szövegírásra.
 *
 * A szövegek KÖTELEZŐ forrása: docs/facebook-content-brief.md (user
 * utasítás, 2026-09-09: „csak ez alapján készülhet bármilyen poszt").
 *
 * ───────────────────────────────────────────────────────────────────────────
 * 2026-09-16 ÁTÉPÍTÉS — user report: „volt egy briefem fb poszt írásra, mert
 * most is kalap szar még. elvileg megcsináltad, gyakorlatban ugyanazok a szar
 * posztok mennek."
 *
 * A gyökérok: a brief egy DOKUMENTUM volt, amit én olvastam el — a posztokat
 * viszont ez a kód gyártja, és a kód nem ismerte a brief 3. pontjának
 * szerkezetét. Ami élesre ment (valódi példa, 2026-09-15):
 *
 *     ❌ Schmidt Mária: felmentették!
 *     Na, ez gyorsan ment 🚪
 *
 *     főigazgató, Terror Háza Múzeum
 *
 *     Részletek: kegyencjarat.hu/lemondasok
 *     👉 Kattints és olvasd el a legfrissebb híreket!
 *
 * Hibák a briefhez képest:
 *   - 3.2 „MI TÖRTÉNT?" — nincs. A törzs egy beosztás-töredék, nem mondat.
 *   - 3.3 „MIÉRT ÉRDEKES?" — teljesen hiányzik.
 *   - 3.4 CTA — generikus („olvasd el a legfrissebb híreket"), holott a brief
 *     típusonként konkrét CTA-t ír elő („Nézd meg, kiket rúgtak ki").
 *   - 2. „kerüld az üres kliséket" — a „Na, ez gyorsan ment 🚪" pontosan az,
 *     ráadásul egy felmentésre ráolvasva tényszerűen is félrevihet.
 *
 * Ez a modul mostantól a brief 3. pontjának NÉGY BLOKKJÁT építi, ebben a
 * sorrendben, blokkonként üres sorral elválasztva (4. pont: mobilon olvasható
 * tagolás, nincs szövegfal):
 *
 *     1. HOOK           — rövid, konkrét, egyetlen funkcionális emojival
 *     2. MI TÖRTÉNT?    — 1–3 rövid, TELJES mondat
 *     3. MIÉRT ÉRDEKES? — kontextus (számokból, tényszerűen)
 *     4. CTA + forrás   — típusra szabott cselekvés
 * ───────────────────────────────────────────────────────────────────────────
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

/**
 * Brief 3.4 — a CTA legyen KONKRÉT és a poszt témájához illő, ne egy
 * mindenhova odabiggyesztett „olvasd el a híreket". A brief maga sorolja fel
 * a mintákat („Nézd meg, kiket rúgtak ki", „Nézd meg, ki van előzetesben",
 * „Töltsd ki a kvízt"), ezért ez a térkép a briefből származik, nem
 * találgatásból. Kickerenként, mert a kicker már úgyis az eseménytípust
 * azonosítja (l. KICKER_EMOJI).
 */
const CTA_BY_KICKER: Record<string, string> = {
  'LEMONDÁS': '👉 Nézd meg, kik mondtak le és kiket rúgtak ki.',
  'KIRÚGÁS': '👉 Nézd meg, kiket rúgtak ki.',
  'FELMENTÉS': '👉 Nézd meg, kiket mentettek fel és kiket rúgtak ki.',
  'VISSZAHÍVÁS': '👉 Nézd meg, kik távoztak a NER-ből.',
  'TÁVOZÁS': '👉 Nézd meg, kik távoztak a NER-ből.',
  'ELŐZETESBEN': '👉 Nézd meg, ki van előzetesben.',
  'ŐRIZETBE VÉVE': '👉 Nézd meg, kit vettek őrizetbe.',
  'LETARTÓZTATVA': '👉 Nézd meg, ki van előzetesben.',
  'ÍTÉLET': '👉 Nézd meg a bírósági ítéleteket.',
  'JOGERŐS ÍTÉLET': '👉 Nézd meg a jogerős ítéleteket.',
  'VÁDEMELÉS': '👉 Nézd meg, ki ellen emeltek vádat.',
  'SZABADLÁBON': '👉 Nézd meg, kit engedtek szabadon.',
  'ELJÁRÁS MEGSZŰNT': '👉 Nézd meg a folyamatban lévő eljárásokat.',
  'FELMENTVE': '👉 Nézd meg a bírósági ügyeket.',
  'VAGYONVISSZASZERZÉS': '👉 Nézd meg, mennyi közpénz került eddig vissza.',
  'FELJELENTÉS': '👉 Nézd meg az összes feljelentést.',
  'KVÍZ': '👉 Töltsd ki a kvízt.',
  'MEGSZŰNÉS': '👉 Nézd meg, mely médiumok szűntek meg.',
  'LEÉPÍTÉS': '👉 Nézd meg, hol volt leépítés.',
  'ELMARADT ESEMÉNY': '👉 Nézd meg, mi maradt el.',
  'MÉDIA-HÍR': '👉 Nézd meg, mi történik a médiapiacon.',
  'KIEMELT ÜGY': '👉 Nézd meg a teljes ügyet a Kegyencjáraton.',
  'ADATBÁZIS': '👉 Nézd meg a teljes ügyet a Kegyencjáraton.',
  'SZAVAZÁS EREDMÉNYE': '👉 Nézd meg a teljes eredményt.',
};

/** Ha egy kicker nincs a térképben, ez megy — de a lista szándékosan lefedi
 *  az ÖSSZES ma létező kickert, hogy ez tényleg csak jövőbeli, még nem
 *  kategorizált trigger-típusra maradjon. */
const FALLBACK_CTA = '👉 Nézd meg a teljes ügyet a Kegyencjáraton.';

/** A kickerhez tartozó funkcionális emoji — a poszt első sora ÉS a kép
 *  badge-e is EBBŐL dolgozik, hogy a kettő ne csússzon szét (a kép eddig
 *  minden kategóriára a generikus 🚨-t rajzolta, l. brief 5. pont). */
export function emojiForKicker(kicker: string): string {
  return KICKER_EMOJI[kicker] ?? '🚨';
}

export function ctaForKicker(kicker: string): string {
  return CTA_BY_KICKER[kicker] ?? FALLBACK_CTA;
}

// 2026-09-08 user brief (docs/facebook-content-brief.md 3. és 5. pont) — a
// Facebook-poszt legelső sora legyen MAGA a hook (a konkrét, tényszerű
// headline — pl. "Kirúgták X-et."), EGYETLEN funkcionális emojival, ne egy
// generikus "🚨 KICKER" all-caps felkiáltás. A kicker (kategória-szó) attól
// nem szűnt meg fontosnak lenni — az eseménytípusra utaló emoji ÉPPEN a
// kickerből dönt, csak nem íródik ki külön, dupla soron a kép-badge-en
// KÍVÜL is. Zárt lista, mert a brief konkrét emoji-t ír elő kategóriánként,
// nem "bármi odaillő"-t — ha egy kicker nincs a listán, a semleges 🚨 marad
// a fallback (pl. jövőbeli, még nem kategorizált trigger-típus).
export const KICKER_EMOJI: Record<string, string> = {
  'LEMONDÁS': '👋',
  'KIRÚGÁS': '❌',
  // Brief 12. pont: a felmentés NEM kirúgás. Eddig mindkettő '❌'-et kapott,
  // ami a képen és a poszt első sorában is kirúgásnak mutatta a felmentést
  // (Schmidt Mária-poszt, 2026-09-15). Külön, semlegesebb jel.
  'FELMENTÉS': '📄',
  'VISSZAHÍVÁS': '↩️',
  'TÁVOZÁS': '👋',
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

/**
 * PLACEHOLDER-VÉDŐHÁLÓ a poszt-szövegre.
 *
 * 2026-09-16: a `<UNKNOWN>` bejelentő nem csak az adatbázisba került be,
 * hanem KI IS MENT egy Facebook-poszt első sorába („📄 <UNKNOWN>
 * feljelentést tett: Pilz Tamás…"). A detektor-oldali kapu (isPlaceholderName
 * a filerName-en) ma már megfogja az új sorokat, de a poszt-építő a MÁR
 * MEGLÉVŐ sorokból is dolgozik — ezért itt is kell egy háló. Ugyanaz az elv,
 * mint a safeLinkPath()-nál: inkább ne menjen ki poszt, mint hogy szemét
 * menjen ki.
 */
const PLACEHOLDER_MARKERS = ['<unknown>', 'unknown', 'undefined', 'null', '[object object]', 'nan'];

export function containsPlaceholderText(...parts: Array<string | null | undefined>): boolean {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  if (!text.trim()) return false;
  return PLACEHOLDER_MARKERS.some((m) => text.includes(m));
}

/**
 * A brief 3. pontja szerinti négyblokkos poszt.
 *
 * @param kicker        eseménytípus — ebből jön az emoji és a CTA
 * @param headline      1. blokk: a HOOK. Rövid, konkrét, entitásra szabott.
 * @param whatHappened  2. blokk: MI TÖRTÉNT — 1–3 rövid, TELJES mondat.
 * @param whyItMatters  3. blokk: MIÉRT ÉRDEKES — kontextus, tényszerűen.
 * @param linkPath      forrás-útvonal a kegyencjarat.hu alatt
 * @param cta           4. blokk; ha nincs megadva, a kickerhez tartozó
 *                      konkrét CTA megy (brief 3.4)
 *
 * A hiányzó blokkok egyszerűen kimaradnak — sose keletkezik két egymást
 * követő üres sor, és sose marad ott egy üres címke.
 */
export function breakingCaption(
  kicker: string,
  headline: string,
  whatHappened?: string,
  linkPath?: string,
  cta?: string,
  whyItMatters?: string,
): string {
  const emoji = emojiForKicker(kicker);
  const blocks: string[] = [`${emoji} ${headline}`];

  const what = (whatHappened ?? '').trim();
  if (what) blocks.push(what);

  const why = (whyItMatters ?? '').trim();
  if (why) blocks.push(why);

  blocks.push([
    cta?.trim() || ctaForKicker(kicker),
    `Részletek: kegyencjarat.hu${safeLinkPath(linkPath)}`,
    '#kegyencjarat #korrupció',
  ].join('\n'));

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
    cta,
    `Minden adat, forrás és részlet: kegyencjarat.hu${safeLinkPath(linkPath)}`,
    '#kegyencjarat #korrupció',
  ].join('\n');
}
