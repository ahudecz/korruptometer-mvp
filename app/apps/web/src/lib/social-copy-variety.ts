/**
 * Zero-cost, kézzel megírt "hangszín" variánsok a Social Post Outbox
 * caption-jeihez — user kérés, 2026-09-07: nem akar pluszban fizetni egy
 * ChatGPT/LangDock-hívásért csak azért, hogy a Facebook-poszt-szöveg
 * élőbb legyen; ez a réteg NEM hív semmilyen LLM-et, egyszer megírt,
 * forgó "hook"-mondatokból választ.
 *
 * A hook-mondat ÖNÁLLÓ, sose fúzionál a tényszerű résszel (név, összeg,
 * intézmény) — így garantáltan nem tud nyelvtanilag elromlani egy
 * ismeretlen intézménynév/összeg miatt (l. feedback-proofread-generated-
 * text memória: a generált szöveget mindig vissza kell tudni olvasni és
 * ellenőrizni — egy kézzel írt, fix mondatkészletnél ez egyszeri feladat,
 * nem minden poszttal újra felmerülő kockázat).
 *
 * A kiválasztás determinisztikus (a triggerRefId/seed hash-e alapján),
 * NEM Math.random() — így egy adott rekordhoz mindig ugyanaz a hook tartozik,
 * ha a jelölt véletlenül kétszer épülne (pl. retry), a Telegram-jóváhagyó
 * ugyanazt a szöveget látja újra, nem egy másikat.
 */

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function pickBySeed<T>(seed: string, options: readonly T[]): T {
  if (options.length === 0) throw new Error('pickBySeed: empty options');
  const idx = hashSeed(seed) % options.length;
  return options[idx]!;
}

const HOOKS = {
  resignation: ['Megint egy hellyel kevesebb a NER-ben 👋', 'Na, ez gyorsan ment 🚪', 'Friss távozás érkezett a NER berkeiből 👀'],
  media_closure: ['Egy médiummal megint kevesebb 📉', 'Ezt most jelentették be 🗞️', 'Friss fejlemény a médiapiacon 🔌'],
  court_verdict: ['Kimondta a bíróság ⚖️', 'Friss bírósági döntés 🔨', 'Friss ítélet érkezett 📢'],
  asset_recovery: ['Ezt sikerült visszaszerezni 💰', 'Egy kis elégtétel a közpénzért ✅', 'Friss siker a vagyonvisszaszerzésben 📈'],
  criminal_complaint: ['Új feljelentés érkezett 📄', 'Ezt most jelentették fel ✍️', 'Erről most számoltak be 🚨'],
  catalog_highlight: ['Emlékszel még erre? 🔎', 'Vissza a gyökerekhez 📚', 'Ezt talán elfelejtetted 🕰️'],
  gallery_highlight: ['Emlékszel még erre? 🔎', 'Vissza a gyökerekhez 📚', 'Ezt talán elfelejtetted 🕰️'],
  quiz_highlight: ['Teszteld a tudásod! 🧠', 'Kvízidő! 🎯', 'Mennyit tudsz erről? ❓'],
  poll_final_result: ['Lezárult a szavazás 📊', 'Megvan a végeredmény 🏁', 'Itt az eredmény! ✅'],
} as const satisfies Record<string, readonly string[]>;

export type HookTriggerType = keyof typeof HOOKS;

/** Determinisztikus hook-mondat egy trigger-típushoz. Ismeretlen
 *  triggerType-ra (pl. complaint_milestone/summary_stats, aminek saját,
 *  már megírt szövege van) `undefined`-ot ad — nincs erőltetett hook. */
export function hookFor(triggerType: string, seed: string): string | undefined {
  const pool = HOOKS[triggerType as HookTriggerType] as readonly string[] | undefined;
  if (!pool || pool.length === 0) return undefined;
  return pickBySeed(seed, pool);
}

const RESIGNATION_VERBS: Record<string, string> = {
  'lemondás': 'lemondott!',
  'kirúgás': 'kirúgták!',
  'felmentés': 'felmentették!',
  'visszahívás': 'visszahívták!',
};

/** "Név: ige!" fejléc — a kettőspontos, igés forma nem igényel egyeztetést
 *  a névvel (l. valódi magyar hírfejlécek: "Novák Katalin: lemondott"),
 *  ezért ismeretlen/idegen nevekre is biztonságos. */
export function resignationHeadline(name: string, resignationType: string): string {
  const verb = RESIGNATION_VERBS[resignationType] ?? 'távozott!';
  return `${name}: ${verb}`;
}

// 2026-09-08 user report: "X feljelentést tett hűtlen kezelés gyanúja
// ellen" ment ki élesen jóváhagyásra — a CriminalComplaint.targetEntity
// mező (a prompt szerint "a feljelentett fél RÖVID, ÖNÁLLÓ NEVE", l.
// criminal-complaint-detect.ts) ide néha egy BŰNCSELEKMÉNY-LEÍRÁST kap az
// LLM-től a névhely helyett — a prompt ezt explicit tiltja, de nem
// garantálja. Az "ellen" névutó egy bűncselekmény-leírásra ráépítve
// nyelvtanilag hibás/értelmezhetetlen mondatot ad (kinek/minek a gyanúja
// ellen?). Ugyanaz a hibaosztály, mint a 2026-09-07-i Waberer's-fix (l.
// check-social-triggers.ts buildComplaintTriggers) — csak ott a targetName
// oldalán, itt a targetEntity oldalán csúszott be a probléma. Zárt
// szólista, ugyanaz a minta, mint a review.ts DANGLING_LAST_WORDS/
// COLLECTIVE_NAME_RE: ha targetEntity ezek bármelyikét tartalmazza, az NEM
// egy önálló név, hanem egy bűncselekmény/eljárás-leírás — sose épülhet rá
// az "ellen" forma, mert egy valódi intézmény/személynév sosem tartalmazza
// ezeket a szavakat.
const CRIME_DESCRIPTION_MARKERS = [
  'gyanúja', 'gyanúval', 'gyanús', 'vádjával', 'vádemelés', 'gyanúja miatt',
  ' miatt', 'ügyében', 'elkövetése', 'elkövetésének', 'bűncselekmény',
  'hűtlen kezelés', 'költségvetési csalás', 'sikkasztás',
];

/** True ha `value` egy bűncselekmény/eljárás-LEÍRÁS (pl. "hűtlen kezelés
 *  gyanúja"), nem egy önálló név — l. fenti komment. Ilyenre sosem
 *  biztonságos az "X ellen" mondatszerkezet. */
export function looksLikeCrimeDescription(value: string): boolean {
  const normalized = ` ${value.trim().toLowerCase()} `;
  return CRIME_DESCRIPTION_MARKERS.some((marker) => normalized.includes(marker));
}

/** "X feljelentést tett Y ellen" / "X feljelentést tett: Y" — a fejléc
 *  egyetlen belépési pontja, hogy a döntés (van-e biztonságosan használható
 *  targetEntity) ne ismétlődhessen szét/csúszhasson el a hívási helyeken.
 *  Az "ellen" forma csak akkor mehet ki, ha targetEntity kitöltött ÉS nem
 *  bűncselekmény-leírás (l. looksLikeCrimeDescription) — minden más esetben
 *  a kettőspontos forma megy, ami BÁRMILYEN szabad szövegre (targetName)
 *  nyelvtanilag biztonságos, sose igényel egyeztetést. */
/**
 * Brief 3.1 — „A hook legyen rövid." A bejelentő neve mögött gyakran ott van
 * a teljes szervezeti megnevezés zárójelben („Király József (Szövetség a
 * Hírös Városért Egyesület)"), amitől a poszt ELSŐ SORA egy bekezdés hosszú
 * lett (valódi poszt, 2026-09-16).
 *
 * A zárójeles rész NEM VÉSZ EL (brief 6.): a teljes név a MI TÖRTÉNT blokkba
 * kerül, l. complaintWhatHappened() `filerName` paraméterét.
 */
const TRAILING_PARENTHETICAL = /\s*\([^)]*\)\s*$/;

export function hookShortName(value: string): string {
  const stripped = value.replace(TRAILING_PARENTHETICAL, '').trim();
  return stripped || value.trim();
}

// 2026-09-22 user report: „a pórul járt cég feljelentést tett: Rendőrség
// nyomkövetős okosóra-beszerzés" — KÉT külön hiba egy mondatban.
//
// 1. A filerName nem NÉV volt, hanem körülírás („a pórul járt cég"). Ez a
//    harmadik megjelenése ugyanannak a hibaosztálynak: az LLM egy
//    név-mezőbe leírást ír (2026-09-07 targetName, 2026-09-08 targetEntity,
//    most filerName). Feljelentőt megnevezni kell tudni — ha nincs neve,
//    inkább ne menjen poszt, mint egy azonosíthatatlan „valaki feljelentett
//    valamit" hír. Ugyanaz a zárt szólistás minta, mint a
//    CRIME_DESCRIPTION_MARKERS fent.
// 2. A mondat kisbetűvel kezdődött, mert a hook a nyers mezőértékkel indul.
//    Ez független a fentitől (a „kormány" és „a jegybank" is legitim,
//    kisbetűs bejelentő a táblában), ezért a nagybetűsítés MINDIG megtörténik.
const DESCRIPTIVE_FILER_MARKERS = [
  'pórul járt', 'az érintett', 'a károsult', 'a panaszos', 'a sértett',
  'az egyik cég', 'egy cég', 'a cég', 'a vállalkozás', 'a társaság',
  'ismeretlen bejelentő', 'egy magánszemély', 'a feljelentő',
];

/** True, ha `value` nem a bejelentő NEVE, hanem körülírás („a pórul járt
 *  cég"). Ilyen sorból nem épülhet poszt — l. fenti komment. */
export function looksLikeDescriptiveFiler(value: string): boolean {
  const normalized = ` ${value.trim().toLowerCase()} `;
  return DESCRIPTIVE_FILER_MARKERS.some((marker) => normalized.includes(marker));
}

/** A hook első betűje nagy — a mezőértékek egy része kisbetűs („kormány",
 *  „a jegybank", „közmédia átmeneti vezetése"), és mondatot sose kezdünk
 *  kisbetűvel. A többi karakter érintetlen marad (a „veglegestorles.hu"
 *  típusú neveket nem írjuk át). */
export function capitalizeFirst(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return trimmed;
  return trimmed[0]!.toLocaleUpperCase('hu-HU') + trimmed.slice(1);
}

export function complaintHeadline(filerName: string, targetEntity: string | null | undefined, targetName: string): string {
  const filer = hookShortName(filerName);
  if (targetEntity && !looksLikeCrimeDescription(targetEntity)) {
    return capitalizeFirst(`${filer} feljelentést tett ${targetEntity} ellen`);
  }
  return capitalizeFirst(`${filer} feljelentést tett: ${targetName}`);
}

// 2026-09-08 user report ("levágod a szöveget mindkettőn a felénél") — a
// check-social-triggers.ts építői egy hosszú szabad szöveget (kvíz-intro,
// ítélet-summary, kiemelt-ügy-summary) eddig nyers `.slice(0, N) + '…'`
// karakter-vágással rövidítettek, ami KÖZÉPEN VÁGOTT EL EGY SZÓT (pl. "...
// rejtélyes befekte…" — a "befektetésekben" szó közepén), és ez a levágott
// szöveg mindkét helyre kiment: a KÉPRE ÉS a poszt-szövegbe is (ugyanaz a
// `detail` változó adta mindkettőt). Ugyanaz a hibaosztály, mint a
// review.ts truncateDescriptionWords() — csak ott szó-SZÁM, itt karakter-
// SZÁM a korlát; a megoldás elve azonos: sose vágj a korlát közepén levő
// szóhatáron belül, mindig az utolsó TELJES szóig vágj vissza.
//
// Emellett a user kifejezett kérése (l. a beillesztett Facebook-poszt
// briefje): a KÉPRE csak egy rövid "hook"-jellegű alsó sor kerüljön, SOSE
// egy hosszú magyarázó bekezdés — a hosszabb kontextus a poszt SZÖVEGÉBE
// (caption) való, nem a képre. Ezért két külön korlát van: a képen
// megjelenő sor (IMAGE_DETAIL_MAX_CHARS) sokkal rövidebb, mint a caption-be
// kerülő, hosszabb kontextus-mondat (CAPTION_DETAIL_MAX_CHARS).

/**
 * A SZÁMOK BLOKK ELŐÁLLÍTÁSA (brief 3.3).
 *
 * User, 2026-09-21: „semmi lendület, semmi kattintékony szöveg, elalszom mire
 * elolvasom." A korábbi poszt egyetlen tömbben hozta a leírást, benne a
 * számokkal elrejtve. A jó poszt ugyanezeket a számokat EGYENKÉNT, külön
 * sorban mutatja.
 *
 * Nem kell hozzá se LLM, se új adatmező: a leírás mondatai közül azokat
 * emeljük ki, amelyekben SZÁM van. Ami marad, az lesz a „MI TÖRTÉNT" blokk.
 * Így a szöveg minősége a leíráson múlik — azon, ami eddig is megvolt.
 *
 * Miért mondat-szinten: egy féloldalas tőmondat-darab („400 millió dollár")
 * önmagában nem mond semmit; a teljes mondat viszont igen, és a brief 6.
 * pontja amúgy is tiltja a forrás csonkolását.
 */
const NUMBER_UNIT = /\d[\d\s .,]*\s*(milliárd|millió|ezer|forint|Ft|dollár|euró|%|százalék|év|hónap|nap)/i;

export function splitSentences(text: string): string[] {
  return (text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÖŐÚÜŰ(„])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function numberBullets(
  text: string | null | undefined,
  maxBullets = 3,
): { lead: string; bullets: string[] } {
  const sentences = splitSentences(text ?? '');
  if (sentences.length === 0) return { lead: '', bullets: [] };

  // Az ELSŐ mondat mindig a felvezetés marad, akkor is, ha van benne szám —
  // enélkül a poszt felsorolással kezdődne, kontextus nélkül.
  const [first, ...rest] = sentences;
  const bullets: string[] = [];
  const leadRest: string[] = [];
  for (const s of rest) {
    if (bullets.length < maxBullets && NUMBER_UNIT.test(s)) bullets.push(s);
    else leadRest.push(s);
  }
  // Egyetlen felsorolás-pont nem felsorolás: maradjon a szövegben.
  if (bullets.length < 2) return { lead: sentences.join(' '), bullets: [] };
  return { lead: [first, ...leadRest].join(' ').trim(), bullets };
}

export const IMAGE_DETAIL_MAX_CHARS = 90;

// 2026-09-09 — a brief 6. pontjának szigorú olvasata: a POSZT SZÖVEGÉT
// (caption) egyáltalán nem szabad rövidíteni. Korábban itt egy 220
// karakteres caption-korlát volt, ami pl. a 244 karakteres kvíz-introból
// levágta a végét ("10 kérdés — …", elveszett a "nagy meglepetések,
// kezdjük!") — ez pontosan az a fajta önkényes információ-elhagyás, amit a
// brief tilt („Ha egy információ nem fér bele, ne dönts önkényesen arról,
// hogy az nem fontos"). A Facebook-poszt hosszának nincs gyakorlati
// korlátja, ezért a caption MINDIG a teljes szöveget kapja.
//
// Az EGYETLEN hely, ahol tényleges platform-korlát van: a Telegram
// sendPhoto felirata max 1024 karakter. Az viszont csak a JÓVÁHAGYÁSI
// ELŐNÉZET — a Facebookra ténylegesen kimenő szöveg a DB caption mezője,
// amit ez nem érint. Ezért ott (és csak ott) vágunk, explicit jelöléssel.
export const TELEGRAM_PREVIEW_MAX_CHARS = 900;

/** A Telegram-előnézet felirata (max 1024 karakter a Bot API-ban). A
 *  visszaadott szöveg CSAK az előnézeté — a DB-ben tárolt, Facebookra
 *  kimenő caption mindig teljes marad. Ha vágni kellett, ezt explicit
 *  kiírjuk, hogy a jóváhagyó tudja: a valódi poszt hosszabb. */
export function telegramPreview(prefix: string, caption: string): string {
  const full = `${prefix}\n\n${caption}`;
  if (full.length <= TELEGRAM_PREVIEW_MAX_CHARS) return full;
  const note = '\n\n[…] (csak az előnézet van levágva — a Facebookra a TELJES szöveg megy ki)';
  const room = TELEGRAM_PREVIEW_MAX_CHARS - note.length - prefix.length - 2;
  const cut = truncateAtWordBoundary(caption, Math.max(room, 100)) ?? caption.slice(0, Math.max(room, 100));
  return `${prefix}\n\n${cut}${note}`;
}

/** Karakterkorlátra vág, DE mindig a korláton belüli utolsó teljes
 *  szóhatárig — sosem hagy félbevágott szót a végén. `undefined`/üres
 *  bemenetre `undefined`-ot ad, hogy a hívó helyén a `?? fallback` mintát
 *  lehessen használni. */
export function truncateAtWordBoundary(value: string | null | undefined, maxChars: number): string | undefined {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length <= maxChars) return trimmed;
  const sliced = trimmed.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.trim().replace(/[.,;:!?…-]+$/, '')}…`;
}

/**
 * A KÉPRE kerülő sor: befejezett mondat(ok), soha nem „…"-ra végződő csonk.
 *
 * 2026-09-10 user report: a képen megint félbevágott szöveg jelent meg
 * („…köztük Őrsi Gergely (DK) II. kerületi…"). A truncateAtWordBoundary()
 * ugyan szó közepén nem vág, de a mondat közepén IGEN, és kitesz egy „…"-t
 * — a képen ez pontosan úgy néz ki, mintha elfogyott volna a szöveg.
 *
 * Ez a függvény ehelyett a korláton belül elférő EGÉSZ mondatokat adja
 * vissza. Ha már az első mondat sem fér el, a mondat végéről vesszős
 * tagmondatokat hagy el, amíg befér (a maradék így is önálló állítás). Csak
 * ha ez sem elég — nincs se mondathatár, se vessző —, akkor esik vissza a
 * régi, „…"-os vágásra, mert a képre akkor is kell valami.
 */
export function fitCompleteSentences(value: string | null | undefined, maxChars: number): string | undefined {
  const trimmed = (value ?? '').replace(/\s+/g, ' ').trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length <= maxChars) return trimmed;

  // 1. A korláton belül elférő egész mondatok.
  const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [trimmed];
  let acc = '';
  for (const s of sentences) {
    const next = (acc + s).trimEnd();
    if (next.length > maxChars) break;
    acc = next + ' ';
  }
  const whole = acc.trim();
  if (whole.length > 0) return whole;

  // 2. Az első mondat sem fér be — tagmondatokat hagyunk el a végéről.
  const first = (sentences[0] ?? trimmed).trim().replace(/[.!?]+$/, '');
  const parts = first.split(/,\s*/);
  while (parts.length > 1) {
    parts.pop();
    const candidate = parts.join(', ');
    if (candidate.length <= maxChars && candidate.split(/\s+/).length >= 4) return candidate;
  }

  // 3. Végső tartalék: a régi viselkedés.
  return truncateAtWordBoundary(trimmed, maxChars);
}

// ───────────────────────────────────────────────────────────────────────────
// BRIEF 3.2 — „MI TÖRTÉNT?" ÉS 3.3 — „MIÉRT ÉRDEKES?"
//
// 2026-09-16, user report: „ugyanazok a szar posztok mennek." A poszt törzse
// eddig egy nyers mezőtöredék volt (pl. „főigazgató, Terror Háza Múzeum"),
// a „miért érdekes" blokk pedig teljesen hiányzott. Mindkettő a brief
// 3. pontjának kötelező eleme.
//
// A mondatsablonok szándékosan ÚGY vannak megírva, hogy a szabad szöveges
// mezők (position, institution, targetName) KETTŐSPONT vagy gondolatjel UTÁN
// álljanak, apozícióban — így semmilyen magyar toldalékolást nem igényelnek.
// Ez ugyanaz az elv, amiért a complaintHeadline() is a kettőspontos formát
// használja az „X ellen" helyett (2026-09-07, Waberer's-eset): egy ismeretlen
// intézménynévre ráépített ragozás garantáltan előbb-utóbb értelmetlen
// mondatot ad, és a hiba csak élesben derül ki.
// ───────────────────────────────────────────────────────────────────────────

/** MI TÖRTÉNT egy lemondás/kirúgás/felmentés posztban. */
export function resignationWhatHappened(
  name: string,
  position: string | null | undefined,
  institution: string | null | undefined,
): string | undefined {
  const pos = (position ?? '').trim().replace(/[.,;]+$/, '');
  const inst = (institution ?? '').trim().replace(/[.,;]+$/, '');
  if (!pos && !inst) return undefined;
  const where = [pos, inst].filter(Boolean).join(' — ');
  return `${name} a következő tisztséget töltötte be: ${where}.`;
}

/** MI TÖRTÉNT egy feljelentés-posztban. */
export function complaintWhatHappened(
  description: string | null | undefined,
  amountLabel: string | null | undefined,
  filerName?: string | null,
): string | undefined {
  const desc = (description ?? '').replace(/\s+/g, ' ').trim();
  const amount = (amountLabel ?? '').trim();
  const lines: string[] = [];
  if (desc) lines.push(desc.endsWith('.') ? desc : `${desc}.`);
  // Brief 6. — amit a hook a rövidítés miatt elhagyott, azt itt pótoljuk: ha
  // a bejelentő teljes neve zárójeles kiegészítést is tartalmazott, a teljes
  // alak ide kerül, hogy ne vesszen el.
  const filer = (filerName ?? '').trim();
  if (filer && hookShortName(filer) !== filer) {
    lines.push(`A feljelentést tette: ${filer}.`);
  }
  // A brief 6. pontja tiltja az információ elhagyását: ha van összeg, az
  // akkor is kimegy, ha a leírás nem említi.
  if (amount) lines.push(`Az érintett összeg: ${amount}.`);
  return lines.length ? lines.join('\n') : undefined;
}

/**
 * MIÉRT ÉRDEKES — kontextus a nyilvántartás futó számaiból.
 *
 * Zéró költségű: sima COUNT-ok, semmilyen LLM-hívás (l.
 * feedback-llm-cost-isolation). Szándékosan visszafogott megfogalmazás: a
 * szám a MI nyilvántartásunk mérete, nem egy országos statisztika — ezért
 * mindig „a nyilvántartásunkban" szerepel benne, hogy ne állítson többet,
 * mint amennyit tudunk (brief 14. és 19. pont).
 */
export type ContextCounts = {
  resignations: number;
  pretrial: number;
  verdicts: number;
  complaints: number;
  closures: number;
  recoveredFtLabel: string | null;
};

export function whyItMattersFor(
  triggerType: string,
  counts: ContextCounts,
  kicker?: string,
): string | undefined {
  switch (triggerType) {
    case 'resignation':
      return counts.resignations > 1
        ? `Vele együtt már ${counts.resignations} távozást tartunk számon a nyilvántartásunkban.`
        : undefined;
    case 'court_verdict':
      // Brief 11. pont: a jogi státuszok nem szinonimák — az „előzetesben"
      // posztnál az előzetesek számát hozzuk, minden másnál a folyamatban
      // lévő eljárásokét. SOSE „ítélet"-ként összegezve (l.
      // [[project-verdict-label-conflation]]).
      if (kicker === 'ELŐZETESBEN' || kicker === 'ŐRIZETBE VÉVE' || kicker === 'LETARTÓZTATVA') {
        return counts.pretrial > 1
          ? `Jelenleg ${counts.pretrial} ember van előzetesben a nyilvántartásunkban.`
          : undefined;
      }
      return counts.verdicts > 1
        ? `A nyilvántartásunkban ${counts.verdicts} büntetőeljárás szerepel NER-hez vagy közpénzhez köthető szereplők ellen.`
        : undefined;
    case 'criminal_complaint':
      return counts.complaints > 1
        ? `Ezzel együtt ${counts.complaints} feljelentés szerepel a nyilvántartásunkban.`
        : undefined;
    case 'media_closure':
      return counts.closures > 1
        ? `Vele együtt már ${counts.closures} megszűnt vagy leépített médiumot tartunk számon.`
        : undefined;
    case 'asset_recovery':
      return counts.recoveredFtLabel
        ? `A nyilvántartásunk szerint eddig összesen ${counts.recoveredFtLabel} közpénz került vissza.`
        : undefined;
    default:
      return undefined;
  }
}

/**
 * BRIEF 8. — a KÉPRE kerülő kiegészítő sor.
 *
 * A kép már hordozza a kickert és a headline-t (NÉV + ESEMÉNY), ez a harmadik,
 * kiegészítő sor. A brief 3–7 szót ír elő az egész képre, ezért ez a sor
 * RÖVID: legfeljebb `IMAGE_SUBLINE_MAX_WORDS` szó.
 *
 * Két konkrét, élesre ment hiba ellen véd (2026-09-15/16):
 *   - ÜRES képszöveg ment ki több poszton (a kép alsó sora egyszerűen hiányzott);
 *   - „felügyelőbizottsági elnök, Nemzeti Reorganizációs Nonprofit Kft. (NRN)"
 *     — 7 szó, de se nevet, se eseményt nem közöl, csak beosztást.
 */
/**
 * 2026-09-24: 7 → 12 szó (user döntés).
 *
 * A 7 szavas korlát mellett a képre matematikailag nem fért ki értelmes
 * mondat, csak mezőnév-érték párok („Érintett összeg: 130 millió Ft") vagy
 * csonkok. A user saját példái a jó képszövegre 9-13 szavasak — ezért ennyi.
 */
export const IMAGE_SUBLINE_MAX_WORDS = 12;

/**
 * CSONK-FELISMERÉS „…" NÉLKÜL IS.
 *
 * 2026-09-25, élesre ment: „Tizennégy kormányközeli alapítvány szűnt meg,
 * köztük" — a képen ÉS a poszt törzseként. A kapu addig csak a „…"-t
 * kereste, de a csonkok nagy része nem így néz ki: a detektor szó-korlátja
 * (review.ts truncateDescriptionWords) vagy a képsor tagmondat-bontása
 * pontjel nélkül vág, és a csonk kész szövegnek látszik. Ugyanez a
 * hibaosztály volt a 09-24-i „Mikucza Tamást, Seszták Miklós volt fejlesztési
 * miniszter" és a 09-25-i kvíz-képsor is.
 *
 * Két független jel (a social-post-policy.ts kapuja mindkettőt futtatja):
 *  1. looksCutOff — a szöveg olyan szóra/írásjelre végződik, ami után
 *     KÖTELEZŐEN folytatás jön (vessző, „köztük", „és", névelő…);
 *  2. isCutPrefixOf — a képsor egy HOSSZABB mondat eleje, ami a
 *     posztszövegben tovább folytatódik, vagyis valaki levágta.
 */
const CONTINUATION_WORDS = new Set([
  // felsorolás-nyitók: „…, köztük" / „többek között" / „például"
  'köztük', 'közöttük', 'például', 'pl', 'úgymint', 'többek', 'ideértve', 'beleértve',
  // kötőszavak
  'és', 'vagy', 'de', 'hogy', 'mint', 'mivel', 'ha', 'mert', 'illetve', 'valamint',
  'majd', 'míg', 'pedig', 'sőt', 'továbbá', 'azonban', 'viszont', 'ám', 'hanem', 'ill',
  // vonatkozó névmások mondatközi helyzetben
  'amely', 'amelyet', 'amelynek', 'amelyek', 'amelyben', 'aki', 'akit', 'akinek', 'akik',
  'ami', 'amit', 'amik', 'amiben', 'ahol', 'amikor', 'miután', 'mielőtt', 'ahogy',
  // névelők
  'a', 'az', 'egy',
  // jelzők, amik után főnév jön (review.ts DANGLING_LAST_WORDS mintájára)
  'volt', 'korábbi', 'jelenlegi', 'egykori', 'leendő', 'megbízott', 'helyettes', 'akkori',
]);

export function looksCutOff(text: string | null | undefined): boolean {
  // Záró emoji/szóköz nem számít (a headline „megszűnt! 🚨" formájú).
  const s = (text ?? '').replace(/[\s\p{Extended_Pictographic}️‍]+$/u, '');
  if (!s) return false;
  if (/…$|\.\.\.$/.test(s)) return true;
  if (/[,;:—–-]$/.test(s)) return true;
  if (/[.!?)"”»]$/.test(s)) return false;
  const last = (s.split(/\s+/).pop() ?? '').toLowerCase().replace(/[^\p{L}]/gu, '');
  return CONTINUATION_WORDS.has(last);
}

/**
 * Egy szó-korláton elvágott mezőérték (pl. MediaClosure.description) záró
 * csonkját levágja: „Tizennégy kormányközeli alapítvány szűnt meg, köztük" →
 * „Tizennégy kormányközeli alapítvány szűnt meg". Ha ezután 3 szónál kevesebb
 * marad, üres — abból nem lesz értelmes mondat.
 */
export function trimCutTail(text: string | null | undefined): string {
  let s = (text ?? '').replace(/\s+/g, ' ').trim();
  while (s && looksCutOff(s)) {
    // előbb a záró írásjel, aztán a folytatást igénylő utolsó szó
    const next = /[,;:—–…-]$|\.\.\.$/.test(s) ? s.replace(/[\s,;:—–….-]+$/, '') : s.replace(/\s*\S+$/, '');
    if (next === s) break;
    s = next.trim();
  }
  return s.split(' ').filter(Boolean).length >= 3 ? s : '';
}

/**
 * Egy hosszabb mondat levágott eleje-e a képsor? Akkor az, ha (a forrás-/
 * feszültség-előtag nélküli) magja szó szerint szerepel a posztszövegben, és
 * ott NEM mondatvég/sorvég követi, hanem a mondat folytatódik.
 */
export function isCutPrefixOf(imageText: string, fullText: string): boolean {
  const norm = (x: string) => x.replace(/[ \t]+/g, ' ').trim();
  const img = norm(imageText).replace(/[.!?]+$/, '');
  const full = norm(fullText);
  if (!img || !full) return false;
  const cores = [img];
  const dash = img.lastIndexOf(' — ');
  if (dash >= 0) cores.push(img.slice(dash + 3));
  const hay = full.toLowerCase();
  for (const core of cores) {
    if (core.split(' ').length < 3) continue;
    const needle = core.toLowerCase();
    for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) {
      const next = full.charAt(at + needle.length);
      if (next !== '' && !/[.!?\r\n]/.test(next)) return true;
    }
  }
  return false;
}

/**
 * KÖTELEZŐ FORRÁS-ELŐTAG (user, 2026-09-24).
 *
 * Ha egy állítást nem erősítette meg hatóság, a képen ki KELL írni, hogy ki
 * szerint. A 2026-09-24-i Mikucza-poszt pont ezen bukott: tényként közölte az
 * őrizetbe vételt, holott a forráscikk szó szerint azt írta, hogy „hatósági
 * megerősítés egyelőre nem érkezett", és az egyetlen forrás egy Facebook-
 * bejegyzés volt. Ez egyben jogi kockázat is: megerősítetlen állítás tényként
 * kimondva pont az a minta, amiből ügyvédi felszólítás lesz.
 *
 * A túl-attribuálás ártalmatlan („A Telex szerint…" akkor is igaz, ha a
 * hatóság is megerősítette), a hiánya viszont nem — ezért a hívó oldalon a
 * szabály a biztonságos irányba téved.
 */
/**
 * A KÉPRE KERÜLŐ SOR STRUKTURÁLT MEZŐKBŐL — nem a summary tömörítéséből.
 *
 * 2026-09-24, user: a gépi sorok unalmasak („A feljelentés státusza:
 * feljelentés"), az ő saját példái viszont ilyenek: „Szorul a hurok:
 * előzetesben Seszták strómanja!", „A Kontroll azt írja: Előállították
 * Seszták strómanját!". Ezek NEM tömörítések — újraírt mondatok, strukturált
 * tényekből: feszültség + esemény + ki.
 *
 * Ezért ez a függvény nem a prózát vágja, hanem sablonból épít. Előnye, hogy
 * SOSE lesz csonk, sose veszti el az alanyát, és nulla LLM-költség — ugyanaz
 * a megoldás, mint a hook-rétegnél.
 *
 * Két nyelvtani szabály van beleégetve:
 *  - SOSE igés+tárgyesetes szerkezet („Előállították Mikucza Tamást"): a név
 *    tárgyragja ismeretlen névvégződésen elcsúszik. Helyette kettőspontos,
 *    alanyesetű forma — ugyanaz az elv, mint a headline-nál (l.
 *    check-social-triggers.ts VERDICT_VERBS melletti komment).
 *  - A FESZÜLTSÉG-NYITÁNY csak akkor jön, ha nincs kötelező forrás-előtag;
 *    a kettő együtt túl hosszú, és a forrás fontosabb.
 */
const VERDICT_TENSION: Record<string, readonly string[]> = {
  'előzetesben': ['Szorul a hurok', 'Rács mögött', 'Letartóztatás'],
  'elsőfokú': ['Megszületett az ítélet', 'Kimondták'],
  'jogerős': ['Jogerős', 'Vége a pernek', 'Kimondták'],
  'vádemelés': ['Bíróság elé áll', 'Vádemelés'],
  'szabadlábra helyezve': ['Kiengedték', 'Szabadlábon'],
  'felmentve': ['Felmentés'],
  'eljárás megszűnt': ['Vége az eljárásnak'],
};

/**
 * A képsor közös építője MINDEN poszt-típushoz.
 *
 * Egy szabály van benne, és az összes típusra ugyanaz: a kicker és a headline
 * már kimondja, KI és MI TÖRTÉNT — ide csak az kerül, ami azokban NINCS.
 * Ha nem marad ilyen, inkább ÜRES a sor, mint tautológia
 * („A feljelentés státusza: feljelentés" — user, 2026-09-24).
 */
export function claimLine(opts: {
  /** A headline-ban NEM szereplő tények, fontossági sorrendben. */
  parts: Array<string | null | undefined>;
  /** Feszültség-nyitány; csak forrás-előtag hiányában jön. */
  tension?: readonly string[];
  /** Hírforrás neve — ha meg van adva, kötelező előtag lesz belőle. */
  attribution?: string | null;
  /** Stabil választás ugyanarra a rekordra. */
  seed: string;
  /** Kiírja-e, hogy „hatósági megerősítés nélkül" (csak ott, ahol ez értelmes). */
  unconfirmedNote?: boolean;
}): string {
  // Félbehagyott mezőérték sose kerül a képre (2026-09-25: a MediaClosure
  // leírása „…szűnt meg, köztük" volt, és ez ment ki a képsorban).
  const reszek = opts.parts.map((p) => (p ?? '').trim()).filter((p) => p && !looksCutOff(p));
  if (reszek.length === 0) return '';
  // Szó-korlát: a `parts` fontossági sorrendben jön, ezért a VÉGÉRŐL hagyunk
  // el, amíg befér. Enélkül a sor túlcsordulna a képen — a korlát eddig csak
  // az imageSubline()-ban volt, itt nem.
  const szavak = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const befer = [...reszek];
  while (befer.length > 1 && szavak(befer.join(', ')) > IMAGE_SUBLINE_MAX_WORDS) befer.pop();
  const mag = befer.join(', ');
  // Egyetlen rész maradt, és még az sem fér be — nincs mit kiírni.
  if (szavak(mag) > IMAGE_SUBLINE_MAX_WORDS) return '';

  const forras = (opts.attribution ?? '').trim().replace(/[.:]+$/, '');
  if (forras) {
    return `${forras} azt írja — ${mag}${opts.unconfirmedNote ? ', hatósági megerősítés nélkül' : ''}`;
  }
  if (!opts.tension || opts.tension.length === 0) {
    return mag.charAt(0).toUpperCase() + mag.slice(1);
  }
  const valasztott = pickBySeed(opts.seed, opts.tension);
  const to = (s: string) => s.toLowerCase().replace(/[^a-záéíóöőúüű]/g, '').slice(0, 8);
  const nagybetus = mag.charAt(0).toUpperCase() + mag.slice(1);
  if (to(valasztott) === to(mag)) return nagybetus;
  // A nyitány is szavakba kerül — ha vele együtt kifutna a korlátból, a
  // TÉNY a fontosabb, a nyitány marad el.
  const teljes = `${valasztott} — ${mag}`;
  return szavak(teljes) <= IMAGE_SUBLINE_MAX_WORDS ? teljes : nagybetus;
}

/** Feszültség-nyitányok a nem-ítélet típusokhoz. Kézzel írt, nulla LLM. */
export const CLAIM_TENSION = {
  resignation: ['Újabb név a listán', 'Eggyel kevesebben'],
  media_closure: ['Lehúzta a rolót', 'Eggyel kevesebb'],
  asset_recovery: ['Visszakerült a kasszába'],
} as const;

export function imageClaimLine(v: {
  personName: string;
  position?: string | null;
  verdictType: string;
  sentenceLabel?: string | null;
  /** A hírforrás neve — KÖTELEZŐ, ha nincs hatósági megerősítés. */
  attribution?: string | null;
  /** Stabil választás ugyanarra a rekordra (rendszerint a sor id-ja). */
  seed: string;
}): string {
  // NÉV nélkül nincs sor. A puszta beosztás („felügyelőbizottsági elnök,
  // Nemzeti Reorganizációs Nonprofit Kft.") 2026-09-15/16-ban már kiment
  // élesbe: se nevet, se eseményt nem közölt. A beosztás csak kiegészítő.
  const nev = v.personName.trim();
  if (!nev) return '';
  const who = [nev, (v.position ?? '').trim()].filter(Boolean).join(', ');

  // A KÉPEN A NÉV ÉS AZ ESEMÉNY MÁR KÉTSZER SZEREPEL: a kickerben
  // („ELŐZETESBEN") és a headline-ban („Pilz Tamás: előzetesben!"). Ha ez a
  // sor is azt ismételné, háromszor ugyanaz állna a képen — pont ettől
  // unalmas (user, 2026-09-24). Ezért ide csak az kerül, ami a másik kettőben
  // NINCS: ki az illető (beosztás), mennyi a büntetés, és megerősített-e.
  const norm2 = (s: string) => s.toLowerCase().replace(/[^a-záéíóöőúüű]/g, '');
  const cimke = (v.sentenceLabel ?? '').trim();
  // A büntetés-címke csak akkor új információ, ha nem ugyanazt mondja, mint a
  // verdictType (amit a kicker már kiír).
  // Szótő-összevetés: az „előzetesben" és az „előzetes letartóztatás" ugyanaz
  // a hír, csak más raggal — a puszta includes() ezt nem fogja meg.
  const to = (s: string) => norm2(s).slice(0, 8);
  const cimkeUj = Boolean(cimke) && to(cimke) !== to(v.verdictType);
  const reszek = [(v.position ?? '').trim(), cimkeUj ? cimke : ''].filter(Boolean);
  const mag = reszek.length > 0 ? reszek.join(', ') : who;

  // Forrás-előtag esetén GONDOLATJEL, nem kettőspont — különben dupla
  // kettőspont lenne („…azt írja: őrizetbe vétel: Mikucza Tamás").
  const forras = (v.attribution ?? '').trim().replace(/[.:]+$/, '');
  // A megerősítés hiánya maga is hír — és ez a legfontosabb, amit a képen
  // látni kell, ha egyetlen lap/Facebook-poszt az egyetlen forrás.
  if (forras) return `${forras} azt írja — ${mag}, hatósági megerősítés nélkül`;

  const nyitany = VERDICT_TENSION[v.verdictType];
  if (!nyitany) return mag;
  const valasztott = pickBySeed(v.seed, nyitany);
  // „Vádemelés — vádemelés: …" — a nyitány és az esemény ugyanaz. Ilyenkor
  // nincs nyitány, elég az esemény.
  // Ha a nyitány ugyanazt mondja, mint a sor tartalma, nincs nyitány.
  const azonos = to(valasztott) === to(mag);
  // Nyitány nélkül a sor kisbetűvel kezdődhet — l. a 2026-09-08-i nagybetűs
  // mondatkezdés javítást ugyanerre a hibaosztályra.
  return azonos ? mag.charAt(0).toUpperCase() + mag.slice(1) : `${valasztott} — ${mag}`;
}

export function withAttribution(line: string, attribution?: string | null): string {
  const clean = (line ?? '').trim();
  const who = (attribution ?? '').trim().replace(/[.:]+$/, '');
  if (!clean) return '';
  if (!who) return clean;
  // Már tartalmaz forrás-megjelölést — ne tegyük ki kétszer.
  if (new RegExp(`${who}\\b`, 'i').test(clean) || /\bszerint\b/i.test(clean)) return clean;
  // KETTŐSPONTOS forma, nem „X szerint <kisbetű>". A kisbetűsítés tulajdonnéven
  // elromlik („A Kontroll szerint mikucza Tamást…"), a kettőspont után viszont
  // a mondat megtartja a saját nagybetűjét. Ez egyben a user saját példája is:
  // „A Kontroll azt írja: Előállították Seszták strómanját!"
  return `${who} azt írja: ${clean}`;
}

/**
 * A szó-korlátot TAGMONDAT-HATÁRON érvényesíti, nem a 7. szónál vakon.
 *
 * 2026-09-24, élesre ment hiba: a képre ez került, befejezett mondatnak
 * látszó csonkként: „Mikucza Tamást, Seszták Miklós volt fejlesztési
 * miniszter". Az ok NEM a `fitCompleteSentences` volt — az helyesen adott
 * vissza egy egész gondolatot —, hanem az, hogy UTÁNA ez a függvény még
 * egyszer vágott, a 7. szónál, mondatszerkezettől függetlenül. Két őr
 * dolgozott egymás ellen: az első befejezett gondolatra vágott, a második
 * szétvágta.
 *
 * A „…" hiánya (2026-09-10) ezt súlyosbította: a csonk nem látszik csonknak,
 * hanem kész mondatnak, ami semmit nem állít.
 *
 * Új sorrend:
 *   1. ha belefér a szó-korlátba, marad;
 *   2. különben az ELSŐ olyan tagmondat/mondat, ami belefér — így a sor
 *      mindig önmagában értelmes;
 *   3. ha még a legrövidebb tagmondat sem fér be, inkább ÜRES sztringgel
 *      térünk vissza, mint csonkkal — a hívó ilyenkor a `fallback`-et kapja,
 *      és ha az sincs, a kép inkább kiegészítő sor nélkül megy ki, mint
 *      értelmetlen szöveggel.
 */
export function imageSubline(value: string | null | undefined, fallback?: string | null): string {
  const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().replace(/[,;:—-]+$/, '');
  const wordCount = (s: string) => s.split(' ').filter(Boolean).length;

  for (const raw of [value, fallback]) {
    const candidate = norm(raw);
    if (!candidate) continue;
    // A záró „…" azt jelenti, hogy egy KORÁBBI lépés (fitCompleteSentences)
    // már elvágta a mondatot. Ilyenkor a szó-szám hiába fér bele: a szöveg
    // attól még csonk. Nem fogadjuk el egészben, hanem tagmondatra bontjuk.
    const csonkolt = /…$/.test(candidate) || looksCutOff(raw);
    if (!csonkolt && wordCount(candidate) <= IMAGE_SUBLINE_MAX_WORDS) return candidate;

    // Az első önmagában is megálló MONDAT, ami belefér.
    //
    // 2026-09-25: korábban vesszőnél és gondolatjelnél is bontott — pont ez
    // gyártotta a csonkokat („Mikucza Tamást, …", a kvíz „Nézzük, mennyit
    // tudsz … — a Matolcsy-kör körüli ügyről"). Magyarban egy vessző előtti
    // rész szinte sosem önálló állítás. Ezért csak mondatvégnél bontunk, és
    // csak pontra/felkiáltó-/kérdőjelre végződő mondatot fogadunk el.
    const clauses = candidate
      .split(/(?<=[.!?])\s+/)
      .map((c) => c.trim())
      .filter((c) => /[.!?]$/.test(c));
    // CSAK AZ ELSŐ tagmondat jöhet szóba — sose egy későbbi.
    //
    // 2026-09-24, mérve: egy későbbi tagmondat kiemelve elveszti az alanyát,
    // és ettől TARTALMILAG HAMIS lesz. A „Mikucza Tamást, Seszták Miklós volt
    // fejlesztési miniszter feltételezett strómanjának nevezik." mondatból a
    // második tagmondat önmagában úgy olvasódik, mintha SESZTÁK lenne az, akit
    // strómannak neveznek. Inkább legyen a sor unalmas (tartalék szöveg), mint
    // hamis.
    const first = clauses[0];
    if (first && wordCount(first) <= IMAGE_SUBLINE_MAX_WORDS && wordCount(first) >= 3) return first;
  }
  return '';
}
