import type { DescriptionBlock, BigCaseVideo, BigCaseRef } from './ugyek-config';

/**
 * Editorial override layer for ADATBÁZIS detail pages, keyed by `scandalKey`.
 * Optional — when present its fields merge ON TOP of the auto-generated base
 * (page.tsx). Mirrors the `UgyekConfig` block model so curated content authored
 * for /ugyek can be reused. Config-as-code; never written by the pipeline.
 *
 * Authoring rule: only put VERIFIED content here (real titles, real source URLs).
 * The auto base already pulls real linked articles from the DB — do not fabricate
 * news, quotes, or sources.
 */
export interface CaseDetailOverride {
  scandalKey: string;
  /** Clean display title (use when the DB name has a baked-in number or is wrong). */
  title?: string;
  /** Override the hero institution line (use when DB institution field is wrong for this scandal). */
  institution?: string;
  /** Hero photo + person link, by galeria entry id. */
  galeriaId?: string;
  /** Suppress the auto-matched hero photo (e.g. when the DB person field is
   *  wrong, so the auto-match would show the wrong face). */
  hidePhoto?: boolean;
  /** Replaces the auto Investigation.summary. */
  summary?: string;
  /** Replaces auto offence-type tags. */
  crimeTypes?: string[];
  /** Suppress the auto numeric damage figure (artifact / unverified). */
  hideAutoDamage?: boolean;
  /** Honest free-text shown instead of / under the figure. */
  damageText?: string;
  damageLabel?: string;
  /** Curated body blocks (text, breaking-group, quote, pdf-link, …). */
  descriptionBlocks?: DescriptionBlock[];
  video?: { id: string; summary?: string };
  additionalVideos?: BigCaseVideo[];
  /** galeria/watchlist ids rendered as related-person cards. */
  relatedPersonIds?: string[];
  /** Cross-ref scandal IDs that should appear first in "Kapcsolódó ügyek". */
  pinnedCrossRefIds?: string[];
  sourceRefs?: BigCaseRef[];
}

export const CASE_OVERRIDES: CaseDetailOverride[] = [
  {
    // A 22,4 Mrd becslés egyedi cikkek alapján, nem Orbán tényleges összkára.
    // Az auto-strip sem távolítja el a nevet ("Korrupciós ügyei" értelmetlen lenne).
    scandalKey: 'orban-viktor-korrupcios',
    hideAutoDamage: true,
    damageText: 'Az automatikus becslés (22,4 Mrd) cikk-alapú artefakt, nem összesített kár — ellenőrzés alatt.',
  },
  {
    // DB name has "335 milliárd" baked in; after auto-clean "Rogán KESMA sajtó-támogatási ügye" marad.
    // Override-dal adjunk K-Monitor-szerű kanonikus nevet.
    scandalKey: 'rogan-kesma-335-milliard',
    title: 'KESMA sajtótámogatási botrány',
    crimeTypes: ['Médiakorrupció', 'Közpénzfelhasználás'],
  },
  {
    // DB name is "Rezsibiznisz-..." → the K-Monitor curated name is Elios.
    // DB institution is ALTEO (different Tiborcz company) — override to Elios Zrt.
    scandalKey: 'rezsibiznisz-energiaszolgaltatas',
    title: 'Az Elios Zrt. közbeszerzési sikerei',
    institution: 'Elios Zrt.',
    galeriaId: 'tiborcz-istvan',
    crimeTypes: ['Közbeszerzési visszaélés', 'Összeférhetetlenség'],
  },
  {
    // The DB damage (3750 Mrd) is a budget-context number baked into the name —
    // an artifact, not an alleged corruption damage. Suppress it and link the
    // canonical Mészáros photo. Curated body blocks to be added with real sources.
    scandalKey: 'meszaros-kormany-3750-mrd-pluszkoltseg',
    title: 'Mészáros-érdekeltségek és a költségvetési többletkiadások',
    galeriaId: 'meszaros-lorinc',
    hideAutoDamage: true,
    damageLabel: 'Becsült kár',
    damageText:
      'A nyilvánosan hivatkozott 3750 Mrd Ft költségvetési tétel — nem azonosított konkrét korrupciós kár. Ellenőrzés alatt; a végleges becslés folyamatban.',
    crimeTypes: ['Közpénzfelhasználás', 'Költségvetési kérdések'],
    relatedPersonIds: ['meszaros-lorinc'],
  },

  // ── "Költségvetés/közbeszerzés-érték kárként" — az auto-heurisztika ezeket
  // nem szűri (nincs szám a névben), ezért kézzel jelöljük: a headline szám
  // egy keret/volumen-érték, nem azonosított korrupciós kár. ──
  {
    scandalKey: 'gulyasministrium-kommunikacio',
    hidePhoto: true, // DB person = "Rogán Antal" (téves) → ne mutassuk a rossz arcot
    hideAutoDamage: true,
    damageText:
      'A hivatkozott ~1360 Mrd Ft a minisztérium kommunikációs kerete — nem azonosított korrupciós kár. Ellenőrzés alatt.',
  },
  {
    scandalKey: 'balasy-rogani-propaganda',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott ~1135 Mrd Ft a cégcsoport elnyert közbeszerzéseinek értéke — nem azonosított konkrét kár. Ellenőrzés alatt.',
    relatedPersonIds: ['balasy-gyula', 'rogan-antal'],
  },
  {
    scandalKey: 'meszaros-b-plus-n-szindikatus',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott ~1090 Mrd Ft a szindikátus közbeszerzési volumene — nem azonosított konkrét kár. Ellenőrzés alatt.',
    relatedPersonIds: ['meszaros-lorinc'],
  },
  {
    scandalKey: 'orban-mlsz-futball-korrupcios',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott ~509 Mrd Ft a labdarúgásra fordított közpénz nagyságrendje — nem azonosított konkrét kár. Ellenőrzés alatt.',
    relatedPersonIds: ['orban-viktor'],
  },
  {
    // DB name is a full newspaper headline — way too long for a page title.
    scandalKey: 'mikozben-a-szentesi-korhazban-megfonek-a-betegek-takacs-alla',
    title: 'Szentesi kórház: 18 milliárdos légtechnika-botrány',
  },
  {
    // DB kulcs frissítve: budapest-airport-ter-utalmeneti → budapest-airport-megterulesi-ugy
    // (régi URL-ről next.config.js redirect van)
    scandalKey: 'budapest-airport-megterulesi-ugy',
    title: 'Budapest Airport megtérülési ügy',
    institution: 'Budapest Airport (BA) Zrt.',
    descriptionBlocks: [
      {
        type: 'text',
        content:
          'A magyar állam 2023-ban 3,1 milliárd euróért visszavásárolta a Budapest Airport repülőteret, amelyet 2005-ben adott el. A tranzakciót Nagy Márton gazdasági miniszter felügyelte. Független elemzések szerint a vételár annyira magas, hogy a befektetés még optimista forgalmi előrejelzések mellett sem térülne meg 45 év alatt — a valóságban ennél hosszabb megtérülési idő valószínű. Az állam az Eximbanktól legalább 800 millió euró hitelt vett fel a vásárláshoz.',
      },
    ],
  },
  {
    // Duplikált ügy: ugyanaz a per, két kulcs alatt. Az ngm-25-milliardos-per az érdemi rekord.
    scandalKey: 'barta-eke-nagyper-miniszterium',
    title: 'Barta-Eke NGM 25 milliárdos per',
  },
  {
    scandalKey: 'varkonyi-andrea-csongradi-fold',
    pinnedCrossRefIds: ['varkonyi-andrea-csongradi-fold-vasarlas'],
  },
  {
    scandalKey: 'varkonyi-andrea-csongradi-fold-vasarlas',
    pinnedCrossRefIds: ['varkonyi-andrea-csongradi-fold'],
  },
  {
    // A deal meghiúsult — Budapest élt elővásárlási jogával (2025. január).
    // A DB 18 Mrd-os damage-becsléje félrevezető; nincs ténylegesen teljesített tranzakció.
    scandalKey: 'rakosrendezo-adasveteli',
    title: 'Rákosrendező – meghiúsult Mini-Dubai adásvétel',
    hideAutoDamage: true,
    damageText: 'A tervezett 50,9 milliárd Ft-os adásvétel meghiúsult — Budapest Főváros élt elővásárlási jogával (2025. január). Tényleges pénzmozgás nem volt.',
  },
  {
    // DB name has Cyrillic in title ("Lázás" rendered). Clean override.
    scandalKey: 'lazar-nonius-hotel-menesbirtok',
    title: 'Mezőhegyesi ménesbirtok – Nonius Hotel felújítása',
  },
  {
    // A Kontroll.hu 6 Mrd-os összege téves volt — helyreigazítás: nettó 460 M Ft.
    // A DamageEstimate a hibás cikkből számolt, elnyomjuk és helyes szöveget írunk.
    scandalKey: 'mtva-ai-beszerzesi-ugy',
    hideAutoDamage: true,
    damageText: 'Nettó 460 millió Ft (Kontroll.hu helyreigazítása — az eredeti cikk tévesen 6 milliárdot írt).',
  },
  {
    scandalKey: 'meszaros-janos-occs-kozbeszerzesi',
    title: 'Mészáros János: strómancsalád – az öccs is milliárdos lett',
    hidePhoto: true,
  },
  {
    scandalKey: 'orban-viktor-kozpenzkonsultacio',
    descriptionBlocks: [
      {
        type: 'article-card',
        breaking: true,
        source: '24',
        date: '2026. febr. 09.',
        headline: 'TODO: pontosítsd a headlinet — a 24.hu nem tölthető be automatikusan',
        lead: 'TODO: pontosítsd a leadet',
        url: 'https://24.hu/belfold/2026/02/09/nemzeti-konzultacio-fidesz-kormany-koltseg/',
      },
    ],
  },
  {
    scandalKey: 'lezsaksandor-lakiteleki-nepfoiskola',
    descriptionBlocks: [
      {
        type: 'article-card',
        breaking: true,
        source: '444',
        date: '2026. ápr. 28.',
        headline: 'Lezsák Sándor nem lett képviselő, de kapott közel 5 milliárdot a Lakiteleki Népfőiskola',
        lead: 'Lezsák Sándor a Fidesz-lista 11. helyén szerepelt — elég lett volna a mandátumhoz —, mégis lemondott. Pár nappal korábban a Lakiteleki Népfőiskola Alapítványa közel 4,8 milliárd forint állami támogatást kapott. Az időbeli egybeesés politikai csereüzlet gyanúját veti fel: a mandátum fejében kapott az alapítvány milliárdokat.',
        url: 'https://444.hu/2026/04/28/lezsak-sandor-nem-lett-kepviselo-de-kapott-kozel-5-milliardot-a-lakiteleki-nepfoiskola',
      },
    ],
  },
];

/** Fotóregiszter azokhoz a személyekhez, akik nem szerepelnek a GALERIA-ban.
 * Kulcs: a ScandalCatalog.person mező értéke (pontos egyezés). */
export const PERSON_PHOTOS: Record<string, { photoUrl: string; photoCredit?: string; photoObjectPosition?: string }> = {
  'Lezsák Sándor':   { photoUrl: '/images/persons/lezsak-sandor-ahang.png',                               photoCredit: 'Eredeti fotó: ahang.hu' },
  'Leisztinger Tamás': { photoUrl: '/images/persons/leisztinger_tamas-nemzetisport.hu.png',               photoCredit: 'Eredeti fotó: nemzetisport.hu' },
  'Kocsis Máté':     { photoUrl: '/images/persons/kocsis_mate_ahang.png',                                 photoCredit: 'Eredeti fotó: ahang.hu' },
  'Matolcsy Ádám':   { photoUrl: '/images/persons/matolcsy-adam-hvg.png',                                 photoCredit: 'Eredeti fotó: hvg.hu' },
  'Gattyán György':  { photoUrl: '/images/persons/gattyan_gyorgy_24.hu.png',                              photoCredit: 'Eredeti fotó: 24.hu' },
  'Kósa Lajos':      { photoUrl: '/images/persons/kosa_lajos_mfor.hu.png',                                photoCredit: 'Eredeti fotó: mfor.hu' },
  'Orbán Balázs':    { photoUrl: '/images/persons/orban_balazs_orban-balazs-facebook-oldala.png',         photoCredit: 'Eredeti fotó: Orbán Balázs Facebook oldala', photoObjectPosition: 'center 20%' },
  'Tarsoly Csaba':   { photoUrl: '/images/persons/tarsoly_csaba-ahang.png',                               photoCredit: 'Eredeti fotó: ahang.hu' },
  'Homlok Zsolt':    { photoUrl: '/images/persons/homlok-zsolt-savariaforum.hu.png',                      photoCredit: 'Eredeti fotó: savariaforum.hu' },
  'Emőri Gábor':     { photoUrl: '/images/persons/emori_gabor_marketingfesztival.hu.png',                 photoCredit: 'Eredeti fotó: marketingfesztival.hu' },
  'Palkovics László': { photoUrl: '/images/persons/palkovics_laszlo_ludovikafesztival.uni-nke.hu.png',    photoCredit: 'Eredeti fotó: uni-nke.hu' },
  'Balázs Attila':   { photoUrl: '/images/persons/balazs_attila_hvg.png',                                 photoCredit: 'Eredeti fotó: hvg.hu' },
  'Sára Botond':     { photoUrl: '/images/persons/sara-botond-pecsma.hu.png',                             photoCredit: 'Eredeti fotó: pecsma.hu' },
  'Hernádi Zsolt':   { photoUrl: '/images/persons/hernadi-zsolt-molgroup.info.png',                       photoCredit: 'Eredeti fotó: molgroup.info' },
  'Tarlós István':   { photoUrl: '/images/persons/tarlos_istvan_hirado.hu.png',                           photoCredit: 'Eredeti fotó: hirado.hu' },
  'Lantos Csaba':    { photoUrl: '/images/persons/lantos_csaba_24.hu.png',                                photoCredit: 'Eredeti fotó: 24.hu' },
  'Habony Árpád':    { photoUrl: '/images/persons/habony-arpad_marketingfesztival.hu.png',                photoCredit: 'Eredeti fotó: marketingfesztival.hu' },
  'Nagy Márton':     { photoUrl: '/images/persons/nagy_marton-wikipedia.png',                             photoCredit: 'Eredeti fotó: Wikipédia' },
  'Horváth Csaba':   { photoUrl: '/images/persons/horvath-csaba-onkormanyzati.tv.png',                    photoCredit: 'Eredeti fotó: onkormanyzati.tv' },
  'Szíjj László':    { photoUrl: '/images/persons/szijj-laszlo-ahang.png',                                photoCredit: 'Eredeti fotó: ahang.hu' },
  'Bige László':     { photoUrl: '/images/persons/bige-laszlo-444.png',                                   photoCredit: 'Eredeti fotó: 444.hu' },
};

export function getCaseOverride(scandalKey: string): CaseDetailOverride | null {
  return CASE_OVERRIDES.find((o) => o.scandalKey === scandalKey) ?? null;
}

/** Kézzel felülírt megjelenítési cím. null = nincs override, auto-logikából kell dolgozni. */
export function getCaseDisplayTitle(scandalKey: string): string | null {
  return CASE_OVERRIDES.find((o) => o.scandalKey === scandalKey)?.title ?? null;
}

// ── Auto cím-tisztítás ────────────────────────────────────────────────────────

/** Levágja a "335 milliárd forint" típusú összegeket (pipeline artefakt a névből).
 *  (?!\w) helyett \b — mert \b JS-ben ASCII-alapú és ékezetes végű szavaknál (millió, milliárd) nem megbízható. */
export function cleanTitle(name: string | null | undefined): string {
  if (!name) return '';
  const c = name
    .replace(/[\s—-]*\b\d[\d\s.,]*\s*(milli[aá]rd(os)?|mrd\.?|milli[oó]s?|md)(?!\w)\s*(forint(os)?|ft|eur[oó]s?|eur[oó])?/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+[—-]\s*$/, '')
    .trim();
  return c.length >= 4 ? c : name;
}

// Általános korrupciós-jogi szavak amelyek egyedül értelmetlen címet alkotnak.
const GENERIC_WORDS = new Set([
  'ügye', 'ügyei', 'ügyelete', 'ügy', 'korrupciós', 'botrány', 'per',
  'vád', 'vádak', 'visszaélés', 'korrupcióper', 'ügyletei', 'üzlete',
]);

// Magyar 3. személyű possessív szufixek — ha a maradék ezek egyikével végződik,
// a cím grammatikailag az eltávolított személyre utal vissza → ne vágjuk le.
// Pl. "Észak-macedoniai hitele", "Kastély-birtok ügye", "Vasúti közbeszerzése"
const POSSESSIVE_SUFFIXES = [
  'ügye', 'ügyei', 'ügyelete',
  'hitele', 'hitelei',
  'pere', 'perei',
  'vagyona',
  'ása', 'ése',  // nominalizált igéből képzett possessívok: közbeszerzése, felújítása, megbízása...
];

function isMeaningfulTitle(title: string): boolean {
  const words = title.split(/\s+/).filter((w) => w.length > 3);
  return words.some((w) => !GENERIC_WORDS.has(w.toLowerCase().replace(/[^a-záéíóöőúüűa-z]/gi, '')));
}

function endsWithPossessiveSuffix(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-záéíóöőúüűa-z]/gi, '');
  return POSSESSIVE_SUFFIXES.some((suf) => w === suf || w.endsWith(suf));
}

/**
 * Levágja a személy nevét a cím elejéről, ha ott szerepel (pipeline artefakt).
 * Pl. "Orbán honvédelmi gépek magáncélú használata" → "Honvédelmi gépek magáncélú használata"
 * Ha a maradék értelmetlen (pl. "Korrupciós ügyei") vagy possessív alakra végződik
 * (pl. "Kastély-birtok ügye", "Észak-macedoniai hitele") → visszatér az eredetivel.
 */
function stripLeadingPerson(title: string, person: string | null): string {
  if (!person) return title;
  const personTokens = person.split(/\s+/);
  const titleTokens = title.split(/\s+/);
  let matchCount = 0;
  for (let i = 0; i < personTokens.length && i < titleTokens.length; i++) {
    if (personTokens[i]!.toLowerCase() === titleTokens[i]!.toLowerCase()) matchCount++;
    else break;
  }
  // >= 2 token egyezés VAGY 1 long token (>=5 kar) — utóbbi lefedi az "Orbán honvédelmi..." esetet
  const familyName = personTokens[0] ?? '';
  const shouldTry = matchCount >= 2 || (matchCount === 1 && familyName.length >= 5);
  if (!shouldTry) return title;
  const rest = titleTokens.slice(matchCount).join(' ').trim();
  if (rest.length < 6) return title;
  const candidate = rest.charAt(0).toUpperCase() + rest.slice(1);
  // Ha a maradék csak generikus jogi szavakból áll, ne vágjuk le
  if (!isMeaningfulTitle(candidate)) return title;
  // Ha a maradék számmal kezdődik, a cleanTitle nem tudta eltávolítani (pl. "500 millió eurós...") → ne vágjuk le
  if (/^\d/.test(rest)) return title;
  // Ha az utolsó szó possessív alakra végződik, a cím az eltávolított személyre utal → ne vágjuk le
  const lastWord = rest.split(/\s+/).pop() ?? '';
  if (endsWithPossessiveSuffix(lastWord)) return title;
  return candidate;
}

/**
 * Egységes megjelenítési cím minden felületen.
 * Sorrend: kézi override → auto-tisztított DB név (szám + személy levágva).
 */
export function autoDisplayTitle(
  name: string | null | undefined,
  person: string | null,
  overrideTitle?: string | null,
): string {
  if (overrideTitle) return overrideTitle;
  const base = cleanTitle(name);
  return stripLeadingPerson(base, person);
}
