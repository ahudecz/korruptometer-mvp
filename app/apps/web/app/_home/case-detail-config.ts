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
  video?: { id: string; channel?: string; title?: string; summary?: string };
  /** Suppress the default per-person video (case-video-registry.ts) — use when
   *  that video's topic doesn't match THIS specific case (it's a per-person,
   *  not per-case, video and can be off-topic on a person's narrower cases). */
  hideVideo?: boolean;
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
    // CORRECTION (2026-07-05): a previous override here mislabeled this as
    // "Elios Zrt." — but every member investigation in this scandalKey
    // (Rekord rezsibiznisz 900 Mrd/ALTEO Energiaszolgáltató Nyrt., ALTEO
    // állami kedvezmények/Tiborcz, Mészáros-ALTEO energiaszétosztás,
    // Alternatív Energia Holding szélpark) is about ALTEO — an energy/wind-
    // farm company — not Elios (the unrelated street-lighting tender scandal,
    // which is its own separate, real scandalKey: tiborcz-elios-innovativ).
    // The 900 Mrd headline is itself a "szerződésösszeg" (contract value
    // across 5 companies), not a proven damage figure.
    // Person misattribution + garbled title, found 2026-07-05: the headline
    // ("Bayer Zsolték éppen most költenek el 150 millió forintot" — "Zsolték"
    // = "Bayer Zsolt and co.", a colloquial suffix) is about Bayer Zsolt, not
    // Semjén Zsolt (the extractor likely confused the two "Zsolt"s). The
    // auto-title-cleaner then mangled "Zsolték" into "Zsolták". Hidden from
    // Semjén's photo (wrong face) and excluded from his rollup total
    // (person-rollup-config.ts) since this isn't really his case.
    scandalKey: 'bayer-elohely-irokakadempia',
    title: 'Bayer Zsolt Előretolt Helyőrség Íróakadémiája',
    hidePhoto: true,
    damageText: 'Ez az ügy valójában Bayer Zsolthoz köthető, nem Semjén Zsolthoz — téves személyhez rendelés a forrásadatban.',
  },
  {
    scandalKey: 'rezsibiznisz-energiaszolgaltatas',
    title: 'Rezsibiznisz — ALTEO állami energiakedvezmények',
    institution: 'ALTEO Energiaszolgáltató Nyrt.',
    galeriaId: 'tiborcz-istvan',
    crimeTypes: ['Közpénzfelhasználás', 'Összeférhetetlenség'],
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 900 Mrd Ft öt cég összesített szerződésértéke, nem azonosított konkrét korrupciós kár. Ellenőrzés alatt.',
  },
  {
    // MAJOR misattribution, found 2026-07-05 in the MNB/Pallas Athéné
    // deep-dive: fact-checked the real source article — this is entirely
    // about Matolcsy György/Ádám's PADME/Optima foundation network (GTC and
    // Ultima Capital share-price losses), reported by Telex 2025-03-31. Zero
    // mention of Mészáros Lőrinc anywhere in the source. Every member
    // investigation in this scandalKey is tagged Matolcsy/Orbán Viktor/
    // Garancsi — "Mészáros Lőrinc" only won the person slot via a tied
    // article-count fluke on two mistagged sub-investigations. The 200 Mrd
    // figure itself is real/sourced (unlike most hideAutoDamage cases here) —
    // just attached to the wrong person. Likely overlaps with
    // matolcsy-global-trade-centre-mnb-vagyonkezeles (same GTC investment).
    // 2026-07-05 MNB/Pallas Athéné deep-dive (source articles verified via
    // WebFetch — Telex, Portfolio, HVG). Real story: Matolcsy György, as MNB
    // governor, moved 266 Mrd Ft of MNB profit into the Pallas Athéné
    // foundation network in 2014 (consolidated later under PADME). PADME's
    // own 2024 financial report + HVG reporting show the pool collapsed from
    // ~283 Mrd Ft to ~13 Mrd Ft — a ~270 Mrd Ft loss — mainly through two bad
    // foreign real-estate bets managed by Optima Befektetési Zrt.: a 2020 GTC
    // (Polish REIT) share purchase at a 31% premium over market, and a Swiss
    // luxury-property deal (Ultima Capital). This scandalKey's own 200 Mrd Ft
    // figure is an early (2025-03-31) press estimate of those same GTC/Ultima
    // losses — legitimate and sourced, just superseded by the fuller ~270 Mrd
    // figure and attached to the wrong person (see excludeIds below).
    scandalKey: 'mnb-botrany',
    title: 'Az MNB-alapítványok (Pallas Athéné/PADME) 270 milliárdos vesztesége',
    institution: 'Pallas Athéné Domus Meriti Alapítvány (PADME)',
    galeriaId: 'matolcsy-gyorgy',
    crimeTypes: ['Vagyonkezelési visszaélés', 'Összeférhetetlenség'],
    damageText:
      'Ez az ügy Matolcsy György MNB-alapítványi (Pallas Athéné/PADME) hálózatához tartozik, nem Mészáros Lőrinchez. A hivatkozott 200 Mrd Ft egy korai (2025. márciusi) becslés — a PADME saját 2024-es beszámolója és a sajtó (HVG, Portfolio) szerint az eredeti 283 Mrd Ft-os vagyonból 2024 végére csak 13 Mrd Ft maradt, azaz kb. 270 Mrd Ft veszett el, elsősorban a GTC- és Ultima Capital-befektetéseken keresztül.',
    video: { id: 'I7-rw1so1p0' },
  },
  {
    // Auto-clean strips "Tiborcz" from "Tiborcz Elios Innovatív", leaving the
    // odd standalone title "Elios Innovatív" — this is the real, well-
    // documented Elios közvilágítás-közbeszerzési botrány (Hódmezővásárhely
    // stb.), distinct from the ALTEO energy-contracts case above.
    scandalKey: 'tiborcz-elios-innovativ',
    title: 'Az Elios-botrány',
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
    video: { id: 'RJ-nGkKzhoY', channel: 'Telex', title: 'Rogán és Balásy 16 évig tolták az arcunkba a hazugságaikat', summary: 'Az országot beborító kék plakátok és a kormányzati információnak álcázott propaganda Orbán Viktor kormányzásának szimbólumai lettek. Megnéztük honnan indult és hova jutott tizenhat év alatt a Fidesz tömegmanipulációs gépezete, aminek az egyik legfőbb felelőse és nyertese Balásy Gyula, a héten sírva ajánlotta fel a cégeit az államnak.' },
  },
  {
    scandalKey: 'familiabar-rogan-balasy-propagandapenz',
    video: { id: 'RJ-nGkKzhoY', channel: 'Telex', title: 'Rogán és Balásy 16 évig tolták az arcunkba a hazugságaikat', summary: 'Az országot beborító kék plakátok és a kormányzati információnak álcázott propaganda Orbán Viktor kormányzásának szimbólumai lettek. Megnéztük honnan indult és hova jutott tizenhat év alatt a Fidesz tömegmanipulációs gépezete, aminek az egyik legfőbb felelőse és nyertese Balásy Gyula, a héten sírva ajánlotta fel a cégeit az államnak.' },
  },
  {
    scandalKey: 'rogan-balasy-lounge-design',
    video: { id: 'RJ-nGkKzhoY', channel: 'Telex', title: 'Rogán és Balásy 16 évig tolták az arcunkba a hazugságaikat', summary: 'Az országot beborító kék plakátok és a kormányzati információnak álcázott propaganda Orbán Viktor kormányzásának szimbólumai lettek. Megnéztük honnan indult és hova jutott tizenhat év alatt a Fidesz tömegmanipulációs gépezete, aminek az egyik legfőbb felelőse és nyertese Balásy Gyula, a héten sírva ajánlotta fel a cégeit az államnak.' },
  },
  {
    scandalKey: 'rogan-balasy-it-szerz',
    video: { id: 'RJ-nGkKzhoY', channel: 'Telex', title: 'Rogán és Balásy 16 évig tolták az arcunkba a hazugságaikat', summary: 'Az országot beborító kék plakátok és a kormányzati információnak álcázott propaganda Orbán Viktor kormányzásának szimbólumai lettek. Megnéztük honnan indult és hova jutott tizenhat év alatt a Fidesz tömegmanipulációs gépezete, aminek az egyik legfőbb felelőse és nyertese Balásy Gyula, a héten sírva ajánlotta fel a cégeit az államnak.' },
  },
  {
    scandalKey: 'rogan-szuverenitasvedelem-balasy-kommunikacio',
    video: { id: 'RJ-nGkKzhoY', channel: 'Telex', title: 'Rogán és Balásy 16 évig tolták az arcunkba a hazugságaikat', summary: 'Az országot beborító kék plakátok és a kormányzati információnak álcázott propaganda Orbán Viktor kormányzásának szimbólumai lettek. Megnéztük honnan indult és hova jutott tizenhat év alatt a Fidesz tömegmanipulációs gépezete, aminek az egyik legfőbb felelőse és nyertese Balásy Gyula, a héten sírva ajánlotta fel a cégeit az államnak.' },
  },
  {
    scandalKey: 'ezusthajo-balasy-felmegas-kozbeszerzesi-ugy',
    video: { id: 'RJ-nGkKzhoY', channel: 'Telex', title: 'Rogán és Balásy 16 évig tolták az arcunkba a hazugságaikat', summary: 'Az országot beborító kék plakátok és a kormányzati információnak álcázott propaganda Orbán Viktor kormányzásának szimbólumai lettek. Megnéztük honnan indult és hova jutott tizenhat év alatt a Fidesz tömegmanipulációs gépezete, aminek az egyik legfőbb felelőse és nyertese Balásy Gyula, a héten sírva ajánlotta fel a cégeit az államnak.' },
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
  {
    // The 400 Mrd is a loan face value (1 Mrd EUR to North Macedonia), not a
    // corruption damage figure — the DamageEstimate note itself just converts
    // the loan amount to HUF at the going exchange rate. Found 2026-07-05
    // person-rollup audit.
    scandalKey: 'habony-eszak-macedonia-eximbank',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 400 Mrd Ft egy 1 milliárd eurós állami hitel névértéke Észak-Macedóniának — nem azonosított korrupciós kár. Ellenőrzés alatt.',
  },
  {
    // The DamageEstimate note explicitly states Kósa isn't even named as a
    // witness in the indictment this 459 Mrd figure comes from ("a csengeri
    // örökösnő" case) — the person attribution itself looks wrong, not just
    // the damage figure. Found 2026-07-05 person-rollup audit.
    scandalKey: 'kosa-lajos-ugy',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 459 Mrd Ft egy másik ügy (a "csengeri örökösnő" vádirat) összege, amelyben a forrás szerint Kósa Lajos tanúként sem szerepel — a személyhez kötés téves lehet. Ellenőrzés alatt.',
  },
  {
    // Same loan-face-value artifact as habony-eszak-macedonia-eximbank — this
    // is the earlier 500 M EUR figure for the same North Macedonia Eximbank
    // loan, not a corruption damage. Found 2026-07-05 person-rollup audit.
    scandalKey: 'orban-eszak-macedonia-500meuro',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 190 Mrd Ft egy 500 millió eurós állami hitel névértéke Észak-Macedóniának — nem azonosított korrupciós kár. Ellenőrzés alatt.',
  },
  {
    // The 240 Mrd is MOL's total dividend payout decision (the state's cut as
    // shareholder), not the amount that reached MCC — a separate member
    // investigation in the same scandalKey puts the actual MCC-specific
    // dividend at ~25 Mrd. Person/damage mismatch found 2026-07-05 audit.
    scandalKey: 'mcc-mol-osztalek',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 240 Mrd Ft a Mol teljes osztalékfizetési döntése, nem az MCC-hez került összeg — az ügyön belüli konkrétabb adat szerint az MCC-hez köthető rész kb. 25 Mrd Ft. Ellenőrzés alatt.',
  },
  {
    // The 49 Mrd headline investigation inside this scandalKey is actually
    // about Szijjártó Péter (a state subsidy to the Honvéd's sponsor company),
    // not Leisztinger — his own documented cases (Honvéd purchase, mine co.,
    // land) total roughly 16,8 Mrd. Person/damage mismatch found 2026-07-05 audit.
    scandalKey: 'leisztinger-honved',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 49 Mrd Ft egy Szijjártó Péterhez köthető állami támogatásról szól, nem Leisztinger Tamás ügyéről — az ő dokumentált ügyei ennél jóval kisebbek. Ellenőrzés alatt.',
  },
  {
    // The 30 Mrd headline investigation inside this scandalKey is attributed
    // to Mészáros Lőrinc ("Mészáros Bayer építőipari nyereség"), not Balázs
    // Attila — his own specific Bosnyák téri investigation is ~5,5 Mrd.
    // Person/damage mismatch found 2026-07-05 audit.
    scandalKey: 'bosnyak-teri-beruhazas',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 30 Mrd Ft egy Mészáros Lőrinchez köthető építőipari ügyről szól, nem közvetlenül a Bosnyák téri beruházásról — az ehhez az ügyhöz köthető összeg kb. 5,5 Mrd Ft. Ellenőrzés alatt.',
  },
  {
    // This scandalKey mixes four different people's Dolomit Kft.-related
    // claims (Mészáros Lőrinc, Orbán Viktor, Orbán Győző) with wildly
    // different amounts; the 50 Mrd headline belongs to a Mészáros-attributed
    // investigation about railway stone supply, not the Orbán-family
    // dividend/extraprofit claims the case is otherwise about. Person/damage
    // mismatch found 2026-07-05 audit.
    scandalKey: 'dolomit-meszaros',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 50 Mrd Ft egy Mészáros Lőrinchez köthető vasúti kő-beszerzési ügyről szól, nem az Orbán-családi Dolomit Kft.-osztalékokról — azok dokumentált összege kb. 4,5 Mrd Ft. Ellenőrzés alatt.',
  },
  {
    // The 40 Mrd headline investigation inside this scandalKey ("Pallas Athéné
    // vagyonkezelés") is attributed to Mészáros Lőrinc, not Matolcsy — this
    // whole MNB-alapítvány/Pallas Athéné network is fragmented across many
    // scandalKeys and people (mnb-botrany, matolcsy-global-trade-centre,
    // leszak-neumann-egyetem, kecskemet-neumann-egyetem-alapitvany, …) with a
    // real cross-scandal double-counting risk that needs a dedicated,
    // fact-checked cleanup — this override only fixes the immediate
    // person/damage mismatch found 2026-07-05 audit.
    scandalKey: 'mnb-alapitvany-botrany',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 40 Mrd Ft egy Mészáros Lőrinchez köthető ügyről szól ("Pallas Athéné vagyonkezelés"), nem közvetlenül Matolcsy Györgyről. Az egész MNB-alapítványi hálózat több tucat ügyre és személyre töredezett szét az adatbázisban — érdemi átfedés-szűrést igényel. Ellenőrzés alatt.',
    video: { id: 'I7-rw1so1p0' },
  },
  {
    // The 500 Mrd is Varga Mihály's aspirational recovery TARGET quoted in a
    // headline ("...most visszaszerezne 500 milliárd forintot az MNB-nek"),
    // not a proven loss — and describes the SAME GTC investment as
    // mnb-botrany. Real, sourced total for the whole PADME/Pallas Athéné pool
    // is ~270 Mrd Ft (HVG/Portfolio, PADME's own 2024 report: 283→13 Mrd Ft).
    // Found + fact-checked 2026-07-05 MNB deep-dive.
    scandalKey: 'matolcsy-global-trade-centre-mnb-vagyonkezeles',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 500 Mrd Ft Varga Mihály visszaszerzési célkitűzése, nem igazolt kár — ugyanarról a GTC-befektetésről szól, mint az mnb-botrany ügy. A valós, sajtó által dokumentált teljes PADME-veszteség ~270 Mrd Ft (283→13 Mrd Ft, 2024-es beszámoló alapján).',
    video: { id: 'I7-rw1so1p0' },
  },
  {
    // The Investigation's own components note already flags this: "az 500
    // milliárd forint nagyobb szám, de az a sajtó visszhangja, nem a kár
    // közvetlen becslése" — i.e. the extractor itself identified 266 Mrd as
    // the more accurate figure but picked institution-specific 70 Mrd anyway.
    // Same PADME/GTC story as mnb-botrany and matolcsy-global-trade-centre.
    // Found 2026-07-05 MNB deep-dive.
    scandalKey: 'matolcsy-mnb-gtc-ingatlan-adossag',
    hideAutoDamage: true,
    damageText:
      'Ugyanaz a PADME/GTC-ügy, mint az mnb-botrany és a matolcsy-global-trade-centre-mnb-vagyonkezeles — nem külön kár. Valós, teljes veszteség ~270 Mrd Ft.',
    video: { id: 'I7-rw1so1p0' },
  },
  { scandalKey: 'leszak-neumann-egyetem', video: { id: 'I7-rw1so1p0' } },
  { scandalKey: 'kecskemet-neumann-egyetem-alapitvany', video: { id: 'I7-rw1so1p0' } },
  { scandalKey: 'mnb-matolcsy-alapkezelo', video: { id: 'I7-rw1so1p0' } },

  // ── 2026-07-05 kiemelt-6 top10 audit — újabb person/damage mismatchek ──
  {
    // The 50 Mrd headline investigation ("Találtunk 50 milliárd forintot,
    // amivel Matolcsy Ádám barátai pingpongoztak") is about Matolcsy Ádám
    // (Matolcsy György's son) but tagged to Mészáros Lőrinc in the source
    // data — a distinct mistake from the usual person/article-count mismatch.
    // Matolcsy György's own specific investigations in this cluster total
    // well under 50 Mrd.
    scandalKey: 'matolcsy-szalloda-spekulacio',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 50 Mrd Ft egy Matolcsy Ádámról (Matolcsy György fiáról) szóló, tévesen Mészáros Lőrinchez cimkézett ügyről szól. Ellenőrzés alatt.',
  },
  {
    // Headline is explicitly about Rogán Antal and Balásy Gyula companies,
    // but tagged to Orbán Viktor. The genuinely Rogán-attributed sub-
    // investigation in this scandalKey is only 12 Mrd.
    scandalKey: 'familiabar-rogan-balasy-propagandapenz',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 38 Mrd Ft egy Rogán Antalhoz és Balásy Gyula cégeihez köthető megbízásról szól, tévesen Orbán Viktorhoz cimkézve. Ellenőrzés alatt.',
  },
  {
    // Balásy's own #1 case: the 25 Mrd headline investigation ("Balásy
    // propagandalapon") is tagged to Orbán Viktor, not Balásy — his own
    // largest documented investigation here is 15 Mrd ("Balásy Gyula állami
    // megbízások").
    scandalKey: 'balasy-gyula-ugy',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 25 Mrd Ft egy Orbán Viktorhoz cimkézett ügyről szól — Balásy Gyula saját, ehhez a kulcshoz köthető legnagyobb dokumentált ügye 15 Mrd Ft. Ellenőrzés alatt.',
  },
  {
    // Headline explicitly names Simicska Lajos as the buyer, not Balásy — the
    // genuinely Balásy-attributed sub-investigation here is only 5 Mrd.
    scandalKey: 'balasy-gyula-lounge-communications',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 10 Mrd Ft egy Simicska Lajoshoz köthető cégvásárlási hírről szól, nem közvetlenül Balásy Gyuláról. Ellenőrzés alatt.',
  },
  {
    // Headline is about Orbán Ráhel, not Orbán Viktor — the genuinely
    // Orbán-Viktor-attributed sub-investigation here is 7,2 Mrd.
    scandalKey: 'fidesz-kampanyarc-tamogatas',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 10 Mrd Ft egy Orbán Ráhelhez köthető ügyről szól, nem közvetlenül Orbán Viktorról. Ellenőrzés alatt.',
  },
  {
    // Despite the scandalKey name and the 21,4 Mrd headline investigation
    // both being about Garancsi István, ScandalCatalog attributes the case's
    // "person" to Rogán Antal (from a smaller, more-article-count Rogán-
    // linked sub-investigation). Both people have real, separate documented
    // amounts here — excluded from Rogán's rollup rather than merged, since
    // this looks like a genuinely shared/multi-actor case, not a clean dup.
    scandalKey: 'garancsi-kazino',
    title: 'Garancsi kaszinó pénzkivonás',
    institution: 'Garinvest Projekt Zrt.',
  },

  // ── hideVideo: the per-person video (case-video-registry.ts) makes a
  // specific claim about a DIFFERENT scandal than the one on this page —
  // showing it here reads as if it illustrates this case. Found in the same audit. ──
  {
    // CONFIRMED duplicate, found 2026-07-05 MNB deep-dive: the source article
    // (telex.hu/.../kecskemeti-neumann-janos-egyetemert-alapitvany-...) is
    // about the SAME Kecskemét/Neumann János Egyetemért Alapítvány → Optima
    // bond investment already counted in full under leszak-neumann-egyetem
    // (127,5 Mrd) — just a later (Nov 2025) article about the board meeting
    // minutes for that same deal, misfiled under a law-firm scandalKey.
    scandalKey: 'matolcsy-dla-piper-127mrd',
    hideAutoDamage: true,
    damageText:
      'Ez ugyanaz a 127,5 Mrd Ft-os Kecskemét/Optima kötvényügylet, ami a leszak-neumann-egyetem ügy alatt már szerepel — nem külön kár.',
    video: { id: 'I7-rw1so1p0' },
  },
  { scandalKey: 'matolcsy-nhb-adofizetoi-milliardok', hideVideo: true },
  { scandalKey: 'matolcsy-metu-penzlopas', hideVideo: true },
  { scandalKey: 'matolcsy-raw-development-szekhazbontasa', hideVideo: true },
  { scandalKey: 'matolcsy-mnb-frank-digital', hideVideo: true },
  { scandalKey: 'matolcsy-neumann-egyetem', video: { id: 'I7-rw1so1p0' } },
  { scandalKey: 'tiborcz-nagy-marton-lakhatasi-alap', hideVideo: true },
  { scandalKey: 'tiborcz-konfector-szlovak-korhaz', hideVideo: true },
  { scandalKey: 'tiborcz-durer-park-adavetele', hideVideo: true },
  { scandalKey: 'tiborcz-alapkezelo-trollhalo', hideVideo: true },
  { scandalKey: 'tiborcz-csaladi-vezetoi-poziciok', hideVideo: true },
  { scandalKey: 'tiborcz-allami-szerzodesek', hideVideo: true },
  { scandalKey: 'tiborcz-diorit-tozsdepalota', hideVideo: true },
  { scandalKey: 'tiborcz-koztarsasagi-rezidencia-villapark', hideVideo: true },
  { scandalKey: 'batthyany-tokeallap-kezelo', hideVideo: true },
  { scandalKey: 'rezsibiznisz-energiaszolgaltatas', hideVideo: true },
  // Orbán Viktor's video is specifically about Hatvanpuszta, which isn't in
  // his own top10 (it's a Mészáros-attributed case) — mismatched everywhere.
  { scandalKey: 'orban-viktor-kozpenz-konzultacio', hideVideo: true },
  { scandalKey: 'orban-whb-kajakkenu-kozpont-tulerkeladasi', hideVideo: true },
  { scandalKey: 'rakosrendezo-eagle-hills', hideVideo: true },
  { scandalKey: 'demszky-metro-4-ketes-ugy', hideVideo: true },
  { scandalKey: 'orban-lounge-design-propaganda', hideVideo: true },
  { scandalKey: 'orban-viktor-alapitvany-szerencsejatek', hideVideo: true },
  { scandalKey: 'hegyvidek-ingatlan-aruveres', hideVideo: true },
  { scandalKey: 'kehi-kormany-alapitvany', hideVideo: true },
  // Rogán Antal's video is specifically about the residency-bond program,
  // which isn't in his own top10 either.
  { scandalKey: 'rogan-kesma-335-milliard', hideVideo: true },
  { scandalKey: 'rogan-szendrei-cecilia-ugy', hideVideo: true },
  { scandalKey: 'rogan-balasy-lounge-design', hideVideo: true },
  { scandalKey: 'rogan-magyar-posta-korrupcio', hideVideo: true },
  { scandalKey: 'rogan-propaganda-korrupcios', hideVideo: true },
  { scandalKey: 'rogan-antal-korrupcios-halozat', hideVideo: true },
  { scandalKey: 'rogan-diakhitel-kommunikacio', hideVideo: true },

  // ── 2026-07-05 Semjén kmdb-extraction test (catalog-kmdb-person-extract.ts) ──
  {
    // Real, sourced figure (HVG360: "2020 óta több mint 700 milliárd forintot
    // osztottak ki") but it's the Bethlen Gábor Alapkezelő's TOTAL disbursement
    // since 2020 across all recipients — not Semjén-specific damage. This
    // scandalKey is SHARED with Rogán Antal, Szíjj László and others' smaller,
    // specific sub-cases (5 Mrd, 1.5 Mrd, etc.) — the new 700 Mrd figure would
    // otherwise become the MAX-damage headline for everyone sharing this key.
    scandalKey: 'bethlen-alap-kasszaturites',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 700 Mrd Ft a Bethlen Gábor Alapkezelő teljes, 2020 óta kiosztott összege — nem egyetlen személyhez vagy ügyhöz köthető kár.',
  },
  {
    // Real, sourced figure (24.hu) but it's the AGGREGATE wealth accumulated by
    // ALL Fidesz-adjacent foundations over the whole Orbán era — not a
    // Semjén-specific or single-case damage figure.
    scandalKey: 'ner-alapitvanyi-vagyon',
    hideAutoDamage: true,
    damageText:
      'A hivatkozott 617 Mrd Ft az összes Fidesz-közeli alapítvány felhalmozott vagyona az Orbán-éra alatt — nem egyetlen ügyhöz köthető kár.',
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
