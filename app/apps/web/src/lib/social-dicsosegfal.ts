/**
 * Dicsőségfal-poszt — a /rendszervaltas élő profiloldalainak felidézése.
 *
 * User kérés, 2026-09-25: „vedd bele a dicsőségfal tagjait, amelyikekről van
 * már aloldal … menj végig sorban. Fogalmazz mindig más posztot, de legyen
 * figyelemfelkeltő … Mindig valami felszólító CTA legyen a vége."
 *
 * - SORBAN: a config (FELTAROK) sorrendjében, az utoljára posztolt profil
 *   utáni következővel; a lista végén elölről.
 * - MINDIG MÁS: a sablon a poszt SORSZÁMÁBÓL jön, nem a profilból. 5 sablon és
 *   (jelenleg) 12 profil relatív prímek, így ugyanaz a profil a következő
 *   körben más szöveget kap, és két egymást követő poszt sosem azonos.
 * - Nulla LLM-hívás — kézzel írt sablonok, a hook-réteg mintájára.
 *
 * NYELVTAN: a névre SOSE fűzünk ragot algoritmussal (l. social-copy-variety
 * xHeadline-minta). A részeshatározós alak („Hadházy Ákosnak", „az
 * Átlátszónak") és a névelő profilonként kézzel van megadva a GRAMMAR
 * táblában; a teszt kikényszeríti, hogy minden élő profilnak legyen sora.
 */

import type { Feltaro } from '@app/_home/rendszervaltas-config';

export const DICSOSEGFAL_KICKER = 'DICSŐSÉGFAL';

type Grammar = {
  /** Névelő mondat közepén: '' (személynév), 'a' vagy 'az'. */
  article: '' | 'a' | 'az';
  /** Részeshatározó, névelővel együtt: „Hadházy Ákosnak", „az Átlátszónak". */
  dative: string;
};

export const DICSOSEGFAL_GRAMMAR: Record<string, Grammar> = {
  'hadhazy-akos': { article: '', dative: 'Hadházy Ákosnak' },
  'partizan': { article: 'a', dative: 'a Partizánnak' },
  'atlatszo': { article: 'az', dative: 'az Átlátszónak' },
  'direkt36': { article: 'a', dative: 'a Direkt36-nak' },
  'jambor-andras': { article: '', dative: 'Jámbor Andrásnak' },
  'juhasz-peter': { article: '', dative: 'Juhász Péternek' },
  'puzser-robert': { article: '', dative: 'Puzsér Róbertnek' },
  'panyi-szabolcs': { article: '', dative: 'Panyi Szabolcsnak' },
  'gulyasagyu-media': { article: 'a', dative: 'a Gulyáságyú Médiának' },
  'pottyondy-edina': { article: '', dative: 'Pottyondy Edinának' },
  'molnar-aron': { article: '', dative: 'Molnár Áronnak' },
  'videki-prokator': { article: 'a', dative: 'a Vidéki Prókátornak' },
};

type Forms = { subj: string; Subj: string; dative: string };

/** Hook + a hozzá illő záró CTA. A CTA sosem ismétli a hookot. */
const TEMPLATES: ReadonlyArray<{ hook: (f: Forms) => string; cta: string }> = [
  { hook: (f) => `Mit köszönhetünk ${f.dative}?`, cta: '👉 Nézd meg a konkrét ügyeit!' },
  { hook: (f) => `${f.Subj} szerepe a rendszerváltásban — nézd meg, mit tett hozzá!`, cta: '👉 Olvasd el a teljes profilt!' },
  { hook: (f) => `Miért került fel ${f.subj} a Dicsőségfalra?`, cta: '👉 Nézd meg, mit tett hozzá a rendszerváltáshoz!' },
  { hook: (f) => `${f.Subj} a Dicsőségfalon — ezek a konkrét ügyei!`, cta: '👉 Kattints, és olvasd el mindet!' },
  { hook: (f) => `Ezt tette ${f.subj} a rendszerváltásért!`, cta: '👉 Nézd meg, miért van a falon!' },
];

export const DICSOSEGFAL_TEMPLATE_COUNT = TEMPLATES.length;

function formsFor(f: Feltaro): Forms | null {
  const g = DICSOSEGFAL_GRAMMAR[f.id];
  if (!g) return null;
  const subj = g.article ? `${g.article} ${f.name}` : f.name;
  return { subj, Subj: subj.charAt(0).toUpperCase() + subj.slice(1), dative: g.dative };
}

/** A következő profil SORBAN: az utoljára posztolt utáni; ha nincs ilyen
 *  (vagy az már nem élő), az első. */
export function nextDicsosegfalProfile(live: readonly Feltaro[], lastPostedId: string | null): Feltaro | undefined {
  if (live.length === 0) return undefined;
  const at = lastPostedId ? live.findIndex((f) => f.id === lastPostedId) : -1;
  return live[(at + 1) % live.length];
}

/** Egy ügycím rövid, önálló feje („Hatvanpuszta — a …" → „Hatvanpuszta"). */
function caseShortTitle(title: string): string {
  return title.split(' — ')[0]!.trim();
}

export type DicsosegfalCopy = {
  headline: string;
  whatHappened: string;
  bullets: string[];
  whyItMatters?: string;
  cta: string;
  imageText: string;
  linkPath: string;
};

/**
 * A poszt szövegei. `postIndex` = az eddigi Dicsőségfal-posztok száma —
 * ebből jön a sablon, ezért egymás után sosem ugyanaz a megfogalmazás.
 * null, ha a profilhoz nincs nyelvtani sor (inkább ne menjen ki, mint
 * rosszul ragozva).
 */
export function buildDicsosegfalCopy(f: Feltaro, postIndex: number): DicsosegfalCopy | null {
  const forms = formsFor(f);
  if (!forms) return null;
  const t = TEMPLATES[((postIndex % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length]!;

  const items = f.detail?.cases?.items ?? [];
  const bullets = items.slice(0, 3).map((c) => caseShortTitle(c.title)).filter(Boolean);
  const role = f.role.trim();

  return {
    headline: t.hook(forms),
    // A kártya egymondatos hookja — teljes mondat, a configban kézzel írva.
    whatHappened: f.tagline.trim(),
    // Egyetlen pont nem felsorolás (l. numberBullets).
    bullets: bullets.length >= 2 ? bullets : [],
    whyItMatters: items.length > 0 ? `A profilján ${items.length} konkrét ügy és tett olvasható, forrásokkal.` : undefined,
    cta: t.cta,
    imageText: role.charAt(0).toUpperCase() + role.slice(1),
    linkPath: `/rendszervaltas/${f.id}`,
  };
}
