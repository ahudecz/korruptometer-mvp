import 'server-only';
import { BREAKING_MONITORED_FALLBACK } from '@korr/scrapers';
import { GALERIA } from '@app/_home/galeria-config';
import { WATCH_LIST } from '@app/_home/watchlist-config';
import { UGYEK } from '@app/_home/ugyek-config';

/**
 * Live-derived breaking-detection name/keyword list (spec
 * 007-political-prosecution-detection, FR-008/FR-009) — replaces the old
 * hand-maintained BREAKING_MONITORED array in packages/scrapers, which
 * repeatedly drifted from the actual GALERIA/WATCH_LIST/UGYEK content (see
 * relevance.ts history: stale names like Czeglédy Csaba, Kaleta stayed in
 * the list long after they left the real configs, while new entries like
 * Szíjjártó's newest cases or a new galéria person never made it in).
 *
 * Union'd with the static fallback rather than replacing it outright, so a
 * hand-tuned entry that hasn't made it into a config yet isn't silently
 * dropped, and so a build/import failure degrades to the old behavior
 * instead of breaking the feature entirely.
 */
export function getMonitoredBreakingNames(): string[] {
  try {
    const names = new Set<string>(BREAKING_MONITORED_FALLBACK);
    for (const p of WATCH_LIST) names.add(p.name.toLowerCase());
    for (const g of GALERIA) names.add(g.name.toLowerCase());
    for (const u of UGYEK) {
      for (const kw of u.articleKeywords ?? []) names.add(kw.toLowerCase());
    }
    return Array.from(names);
  } catch {
    // Any config-import failure falls back to the static list (FR-009) —
    // never let a breaking-list bug take down a whole scrape/render.
    return [...BREAKING_MONITORED_FALLBACK];
  }
}
