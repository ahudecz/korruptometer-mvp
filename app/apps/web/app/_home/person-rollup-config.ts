import { MESZAROS_TOP_CASES, type MeszarosCaseWriteup } from './meszaros-osszes-ugye-content';

/**
 * Config for the generic "X összes ügye" rollup pages
 * (/adatbazis/szemely/[slug]). One entry per featured person.
 *
 * `excludeIds` covers two situations, found during the 2026-07-05 data audit:
 *  - confirmed duplicate scandalKeys already merged via a redirect in
 *    [id]/page.tsx (RETIRED_REDIRECTS) — excluded here too so the rollup sum
 *    doesn't double-count them.
 *  - a single scandalKey whose damage figure is a broad/overlapping estimate
 *    or (for kosa-lajos-ugy) a likely person-misattribution — same treatment
 *    as case-detail-config.ts's hideAutoDamage overrides, applied to the sum.
 */
export interface PersonRollupConfig {
  slug: string;
  /** Exact ScandalCatalog.person string to match. */
  personName: string;
  excludeIds?: string[];
  writeups?: MeszarosCaseWriteup[];
}

export const PERSON_ROLLUPS: PersonRollupConfig[] = [
  {
    slug: 'meszaros-lorinc',
    personName: 'Mészáros Lőrinc',
    // mnb-botrany: fact-checked against the real source article (2026-07-05,
    // MNB/Pallas Athéné deep-dive) — it's entirely about Matolcsy György/Ádám's
    // PADME/Optima foundation losses (GTC, Ultima Capital). Every member
    // investigation in this scandalKey is tagged Matolcsy/Orbán Viktor/Garancsi;
    // "Mészáros Lőrinc" only won the ScandalCatalog "person" slot via a tied
    // article-count fluke on two clearly mistagged sub-investigations. Zero
    // legitimate connection to Mészáros.
    // meszaros-kormany-3750-mrd-pluszkoltseg: fact-checked 2026-07-08 — the
    // source article ("Égeti a pénzt az Orbán-kormány, saját hatáskörben még
    // 3750 milliárd forint pluszkiadásról döntött") is about the government's
    // overall extra budget spending, zero mention of Mészáros specifically.
    // meszaros-magantokealap-1311mrd: same audit — source article
    // ("Transparency International: 1311 milliárd forintot fektetett az állam
    // magántőkealapokba") is a state-wide private-equity investment figure,
    // not a Mészáros-attributed sum. Both were single-article, never-reviewed
    // "besorolatlan" stubs that alone accounted for 56% of his nominal total.
    // 2026-07-08 top-500 sweep — 12 more scandalKeys whose title names a
    // different person entirely (Mészáros isn't mentioned anywhere in them):
    // tiborcz-jellinek-central-european-opportunity (Tiborcz/Jellinek deal),
    // matolcsy-adam-balaton-butor (Matolcsy Ádám), matolcsy-uszotusolas
    // (Matolcsy's case being covered up), schmidt-bif-osztalek (Schmidt),
    // nagy-marton-iparkamara-szekhazbeszerzese (Nagy Márton),
    // orban-kormanyzat-rokonok (Orbán's relatives),
    // orban-viktor-formula-gp-tularak (Orbán's F1 venture),
    // tiborcz-arcfelismo-szoftver / tiborcz-kulfold-ingatlan (Tiborcz),
    // meszaros-epkar-kozbeszerzesek (actually Paár Attila's Épkar despite
    // the id), orban-brusszel-szekhely-denco (Orbán), szijj-duna-aszfalt
    // (Szíjj — Mészáros's own much larger Duna Aszfalt entry already covers
    // the real joint case).
    excludeIds: [
      'ner-milliardok', 'meszaros-szvj-autopalya-koncesszio', 'mnb-botrany',
      'meszaros-kormany-3750-mrd-pluszkoltseg', 'meszaros-magantokealap-1311mrd',
      'tiborcz-jellinek-central-european-opportunity', 'matolcsy-adam-balaton-butor',
      'matolcsy-uszotusolas', 'schmidt-bif-osztalek', 'nagy-marton-iparkamara-szekhazbeszerzese',
      'orban-kormanyzat-rokonok', 'orban-viktor-formula-gp-tularak',
      'tiborcz-arcfelismo-szoftver', 'tiborcz-kulfold-ingatlan',
      'meszaros-epkar-kozbeszerzesek', 'orban-brusszel-szekhely-denco', 'szijj-duna-aszfalt',
    ],
    writeups: MESZAROS_TOP_CASES,
  },
  {
    slug: 'tiborcz-istvan',
    personName: 'Tiborcz István',
    // nagy-marton-napenergia-testvere: fact-checked 2026-07-08 — about Nagy
    // Márton's sibling's solar business, no Tiborcz mention.
    // orban-rahel-foldvasarlas-ugy (2026-07-11 rename, was typo'd
    // orban-rakel-foldvasarlas): about Orbán Ráhel's (Tiborcz's ex-wife) own
    // land purchase — no Tiborcz mention in the source article.
    excludeIds: ['rezsibiznisz-energiaszolgaltatas', 'nagy-marton-napenergia-testvere', 'orban-rahel-foldvasarlas-ugy'],
  },
  {
    slug: 'orban-viktor',
    personName: 'Orbán Viktor',
    // orban-eszak-macedonia-500meuro: loan face value, not damage.
    // dolomit-meszaros: headline figure actually belongs to a Mészáros-attributed
    // sub-investigation, not the Orbán-family dividend claims.
    // fidesz-kampanyarc-tamogatas: headline is about Orbán Ráhel, not Orbán Viktor.
    // tiborcz-garancsi-durer-120mrd: fact-checked 2026-07-08 — the source
    // article ("Tiborcz István és Garancsi István cégeinek 120 milliárd
    // juthat") is explicitly about Tiborcz's and Garancsi's companies, not
    // Orbán Viktor; the scandalKey name itself says so.
    // 2026-07-08 top-500 sweep — 6 more, all title-checked to name someone
    // else with zero Orbán mention: alabbar-bm-epulet (Mohamed Alabbar),
    // tiborcz-bar-co-adozas / tiborcz-napeleempark-mvm / tiborcz-mav-palota-bge
    // (Tiborcz), schmidt-maria-onkologia-kommunikacio (Schmidt Mária).
    // 2026-07-11: the 7th (leszak-sandor-lakiteleki-nepfoiskola, Lezsák
    // Sándor's own foundation misattributed to Orbán) no longer needs
    // excluding — merged into lezsaksandor-lakiteleki-nepfoiskola (its
    // correctly-attributed duplicate) at the source, typo'd id retired.
    excludeIds: [
      'orban-eszak-macedonia-500meuro', 'dolomit-meszaros', 'fidesz-kampanyarc-tamogatas',
      'tiborcz-garancsi-durer-120mrd', 'alabbar-bm-epulet',
      'tiborcz-bar-co-adozas', 'tiborcz-napeleempark-mvm', 'tiborcz-mav-palota-bge',
      'schmidt-maria-onkologia-kommunikacio',
    ],
  },
  {
    slug: 'matolcsy-gyorgy',
    personName: 'Matolcsy György',
    // mnb-alapitvany-botrany: headline figure belongs to a Mészáros-attributed
    // sub-investigation ("Pallas Athéné vagyonkezelés"), not Matolcsy.
    // matolcsy-szalloda-spekulacio: headline is about Matolcsy Ádám, tagged
    // to Mészáros in the source data.
    // matolcsy-global-trade-centre-mnb-vagyonkezeles / matolcsy-mnb-gtc-ingatlan-adossag:
    // both re-tell the same PADME/GTC ~270 Mrd Ft loss as mnb-botrany (which
    // itself isn't attributed to Matolcsy in ScandalCatalog) — excluded to
    // avoid re-counting the same money 2-3x. matolcsy-dla-piper-127mrd: same
    // 127,5 Mrd Kecskemét/Optima bond deal already counted under Lezsák
    // Sándor's leszak-neumann-egyetem. Fact-checked 2026-07-05 MNB deep-dive.
    // matolcsy-mnb-szazmilyardok: fact-checked 2026-07-08 — the source
    // article ("Súlyos százmilliárdokba fog még kerülni nekünk Matolcsy
    // MNB-elnöksége") is a speculative future-cost prediction, not a
    // documented sum, and a single-article "besorolatlan" stub like the
    // other excluded entries above.
    excludeIds: [
      'mnb-alapitvany-botrany', 'matolcsy-szalloda-spekulacio',
      'matolcsy-global-trade-centre-mnb-vagyonkezeles',
      'matolcsy-mnb-gtc-ingatlan-adossag', 'matolcsy-dla-piper-127mrd',
      'matolcsy-mnb-szazmilyardok',
    ],
  },
  {
    slug: 'rogan-antal',
    personName: 'Rogán Antal',
    // familiabar-rogan-balasy-propagandapenz: headline tagged to Orbán Viktor.
    // garancsi-kazino: headline investigation actually belongs to Garancsi István.
    // gulyasministrium-kommunikacio: fact-checked 2026-07-08 — the source
    // article ("1360 milliárdot költött az állam a Rogán-féle kommunikációra")
    // is the state's overall communication-budget total (ScandalCatalog's
    // own scandalName even attributes it to "Gulyás Gergely minisztériuma"),
    // not a documented sum tied to Rogán personally.
    // balasy-rendezveny-kozbeszerzesi: fact-checked 2026-07-08 — title only
    // names Balásy Gyula, no Rogán mention.
    excludeIds: [
      'familiabar-rogan-balasy-propagandapenz', 'garancsi-kazino', 'gulyasministrium-kommunikacio',
      'balasy-rendezveny-kozbeszerzesi',
    ],
  },
  {
    slug: 'balasy-gyula',
    personName: 'Balásy Gyula',
    // balasy-gyula-ugy: headline tagged to Orbán Viktor, not Balásy.
    // balasy-gyula-lounge-communications: headline tagged to Simicska Lajos.
    // gulyasministrium-kommunikacio: 2026-07-09 — the 0037 ScandalCatalog
    // tiebreak fix (SUM(articleCount), person ASC on ties) flipped this
    // scandalKey's person from Rogán Antal to Balásy Gyula on a genuine
    // 1-article-vs-1-article tie. Already known-bad (see rogan-antal's own
    // excludeIds above, fact-checked 2026-07-08): the 1360 Mrd figure is the
    // state's total communication budget since 2015, not personal to either.
    // balasy-rogani-propaganda: user call 2026-07-09 — excluded from the
    // rollup total alongside the above (both had reappeared on his page
    // after the tiebreak fix; user asked to re-exclude both).
    excludeIds: [
      'balasy-gyula-ugy', 'balasy-gyula-lounge-communications',
      'gulyasministrium-kommunikacio', 'balasy-rogani-propaganda',
    ],
  },
  { slug: 'szijj-laszlo', personName: 'Szíjj László' },
  {
    slug: 'lazar-janos',
    personName: 'Lázár János',
    // garancsi-criterion-logisztika / pinter-civil-biztonsagi-mav-penztarak:
    // fact-checked 2026-07-08 — titles name Garancsi István and Pintér
    // Sándor respectively, no Lázár mention in either.
    excludeIds: ['garancsi-criterion-logisztika', 'pinter-civil-biztonsagi-mav-penztarak'],
  },
  { slug: 'szijjarto-peter', personName: 'Szijjártó Péter' },
  {
    slug: 'habony-arpad',
    personName: 'Habony Árpád',
    excludeIds: ['habony-eszak-macedonia-eximbank'],
  },
  {
    slug: 'hanko-balazs',
    personName: 'Hankó Balázs',
    excludeIds: ['hanko-balazs-nka-tamogatas'],
  },
  { slug: 'takacs-peter', personName: 'Takács Péter' },
  {
    slug: 'orban-balazs',
    personName: 'Orbán Balázs',
    // mcc-mol-osztalek: 240 Mrd is MOL's total dividend decision, not the
    // amount that reached MCC (~25 Mrd per a separate sub-investigation).
    excludeIds: ['mcc-mol-osztalek'],
  },
  { slug: 'lezsak-sandor', personName: 'Lezsák Sándor' },
  { slug: 'hernadi-zsolt', personName: 'Hernádi Zsolt' },
  { slug: 'sara-botond', personName: 'Sára Botond' },
  {
    slug: 'leisztinger-tamas',
    personName: 'Leisztinger Tamás',
    // leisztinger-honved: headline figure actually belongs to Szijjártó Péter.
    excludeIds: ['leisztinger-honved'],
  },
  {
    slug: 'balazs-attila',
    personName: 'Balázs Attila',
    // bosnyak-teri-beruhazas: headline figure belongs to a Mészáros-attributed
    // sub-investigation, not Balázs Attila's own (~5,5 Mrd) claim.
    excludeIds: ['bosnyak-teri-beruhazas'],
  },
  { slug: 'emori-gabor', personName: 'Emőri Gábor' },
  { slug: 'palkovics-laszlo', personName: 'Palkovics László' },
  {
    slug: 'barta-eke-gyula',
    personName: 'Barta-Eke Gyula',
    // portik-pert: fact-checked 2026-07-08 — the source article is about
    // Portik Tamás, not Barta-Eke Gyula.
    excludeIds: ['barta-eke-nagyper-miniszterium', 'portik-pert'],
  },
  {
    slug: 'garancsi-istvan',
    personName: 'Garancsi István',
    // schmidt-marias-alapitvany-milliardos-szerz: fact-checked 2026-07-08 —
    // the source article is about Schmidt Mária's foundation, not Garancsi.
    excludeIds: ['schmidt-marias-alapitvany-milliardos-szerz'],
  },
  {
    slug: 'gattyan-gyorgy',
    personName: 'Gattyán György',
    // The old 'gattyan-gyorgy-adougy' id never matched (the real id is
    // accented: 'gattyán-györgy-adougy') so this exclusion silently did
    // nothing. Fixed 2026-07-08: also this and 'gattyan-docler-adougy' are
    // the same Docler/NAV tax matter reported under two scandalKeys with
    // the identical 19,4 Mrd figure — kept the better-sourced one (5 cikk)
    // and excluded the duplicate.
    excludeIds: ['gattyán-györgy-adougy'],
  },
  { slug: 'kocsis-mate', personName: 'Kocsis Máté' },
  {
    slug: 'homlok-zsolt',
    personName: 'Homlok Zsolt',
    // szombathelyi-haladas-stadion / meszaros-haladas-labdarugo: fact-checked
    // 2026-07-08 — both are about the Szombathelyi Haladás football club;
    // Homlok Zsolt heads the handball federation (Magyar Kézilabda
    // Szövetség), not football — mistagged to him.
    excludeIds: ['szombathelyi-haladas-stadion', 'meszaros-haladas-labdarugo'],
  },
  {
    slug: 'kosa-lajos',
    personName: 'Kósa Lajos',
    excludeIds: ['kosa-lajos-ugy'],
  },
  {
    slug: 'semjen-zsolt',
    personName: 'Semjén Zsolt',
    // bayer-elohely-irokakadempia: really about Bayer Zsolt, not Semjén.
    // bethlen-alap-kasszaturites / ner-alapitvanyi-vagyon: broad institutional
    // totals (fund's whole disbursement / all NER foundations combined), not
    // Semjén-specific damage — see case-detail-config.ts overrides.
    excludeIds: ['bayer-elohely-irokakadempia', 'bethlen-alap-kasszaturites', 'ner-alapitvanyi-vagyon'],
  },
];

export function getPersonRollup(slug: string): PersonRollupConfig | null {
  return PERSON_ROLLUPS.find((p) => p.slug === slug) ?? null;
}
