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
export function complaintHeadline(filerName: string, targetEntity: string | null | undefined, targetName: string): string {
  if (targetEntity && !looksLikeCrimeDescription(targetEntity)) {
    return `${filerName} feljelentést tett ${targetEntity} ellen`;
  }
  return `${filerName} feljelentést tett: ${targetName}`;
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
