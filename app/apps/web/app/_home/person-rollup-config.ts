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
    excludeIds: ['ner-milliardok', 'meszaros-szvj-autopalya-koncesszio', 'mnb-botrany'],
    writeups: MESZAROS_TOP_CASES,
  },
  {
    slug: 'tiborcz-istvan',
    personName: 'Tiborcz István',
    excludeIds: ['rezsibiznisz-energiaszolgaltatas'],
  },
  {
    slug: 'orban-viktor',
    personName: 'Orbán Viktor',
    // orban-eszak-macedonia-500meuro: loan face value, not damage.
    // dolomit-meszaros: headline figure actually belongs to a Mészáros-attributed
    // sub-investigation, not the Orbán-family dividend claims.
    // fidesz-kampanyarc-tamogatas: headline is about Orbán Ráhel, not Orbán Viktor.
    excludeIds: ['orban-eszak-macedonia-500meuro', 'dolomit-meszaros', 'fidesz-kampanyarc-tamogatas'],
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
    excludeIds: [
      'mnb-alapitvany-botrany', 'matolcsy-szalloda-spekulacio',
      'matolcsy-global-trade-centre-mnb-vagyonkezeles',
      'matolcsy-mnb-gtc-ingatlan-adossag', 'matolcsy-dla-piper-127mrd',
    ],
  },
  {
    slug: 'rogan-antal',
    personName: 'Rogán Antal',
    // familiabar-rogan-balasy-propagandapenz: headline tagged to Orbán Viktor.
    // garancsi-kazino: headline investigation actually belongs to Garancsi István.
    excludeIds: ['familiabar-rogan-balasy-propagandapenz', 'garancsi-kazino'],
  },
  {
    slug: 'balasy-gyula',
    personName: 'Balásy Gyula',
    // balasy-gyula-ugy: headline tagged to Orbán Viktor, not Balásy.
    // balasy-gyula-lounge-communications: headline tagged to Simicska Lajos.
    excludeIds: ['balasy-gyula-ugy', 'balasy-gyula-lounge-communications'],
  },
  { slug: 'szijj-laszlo', personName: 'Szíjj László' },
  { slug: 'lazar-janos', personName: 'Lázár János' },
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
  { slug: 'barta-eke-gyula', personName: 'Barta-Eke Gyula', excludeIds: ['barta-eke-nagyper-miniszterium'] },
  { slug: 'garancsi-istvan', personName: 'Garancsi István' },
  { slug: 'gattyan-gyorgy', personName: 'Gattyán György', excludeIds: ['gattyan-gyorgy-adougy'] },
  { slug: 'kocsis-mate', personName: 'Kocsis Máté' },
  { slug: 'homlok-zsolt', personName: 'Homlok Zsolt' },
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
