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
  /** Clean display title (use when the DB name has a baked-in number). */
  title?: string;
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
  additionalVideos?: BigCaseVideo[];
  /** galeria/watchlist ids rendered as related-person cards. */
  relatedPersonIds?: string[];
  sourceRefs?: BigCaseRef[];
}

export const CASE_OVERRIDES: CaseDetailOverride[] = [
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
];

export function getCaseOverride(scandalKey: string): CaseDetailOverride | null {
  return CASE_OVERRIDES.find((o) => o.scandalKey === scandalKey) ?? null;
}
