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
