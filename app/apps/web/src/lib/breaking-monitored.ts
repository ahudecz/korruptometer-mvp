import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { BREAKING_MONITORED_FALLBACK } from '@korr/scrapers';
import { GALERIA } from '@app/_home/galeria-config';
import { WATCH_LIST } from '@app/_home/watchlist-config';
import { UGYEK } from '@app/_home/ugyek-config';
import { getDb, schema } from './db';

/**
 * Live-derived monitored-entity name list — replaces the old hand-maintained
 * BREAKING_MONITORED array in packages/scrapers, which repeatedly drifted
 * from the actual site content (stale names stayed in the list long after
 * they left the real configs, while new entries never made it in).
 *
 * Used for TWO purposes, both needing "does this article mention someone we
 * track": (1) isBreaking() — headline-only match + a trigger word, and
 * (2) scrapeRelevanceTier()/isRelevant() — the scrape-time gate that decides
 * whether an article is even worth storing. (2) is why this also queries
 * ScandalCatalog/PoliticalResignation/CourtVerdict, not just the static
 * WATCH_LIST/GALERIA/UGYEK configs — a name that only exists in the
 * K-Monitor database (e.g. a person with 15 documented cases but no galéria
 * profile) still needs to reach the scrape gate. This is what closes the
 * recurring "X should have been caught automatically" bug class (2026-07-11
 * audit — Káel Csaba, Nagy Ervin, and 28 K-Monitor top-persons were all
 * missing from the static list at the time they were needed).
 *
 * Union'd with the static fallback rather than replacing it outright, so a
 * hand-tuned entry that hasn't made it into a config/DB yet isn't silently
 * dropped, and so a config-import or DB failure degrades to the old
 * behavior instead of breaking the feature entirely.
 */
export async function getMonitoredNames(): Promise<string[]> {
  const names = new Set<string>(BREAKING_MONITORED_FALLBACK);
  try {
    for (const p of WATCH_LIST) names.add(p.name.toLowerCase());
    for (const g of GALERIA) names.add(g.name.toLowerCase());
    for (const u of UGYEK) {
      for (const kw of u.articleKeywords ?? []) names.add(kw.toLowerCase());
    }
  } catch {
    // Config-import failure — fall through to the DB pull / static fallback.
  }

  try {
    const db = getDb();
    // Csak "Vezetéknév Keresztnév" alakú (szóközt tartalmazó) nevek — egy
    // önmagában álló szó (pl. becenév-töredék) túl kockázatos
    // substring-illeszkedésre. L. relevance.ts 'ász'/Hamász esete.
    const [scandalPersons, resignations, verdicts] = await Promise.all([
      db.execute(sql`SELECT DISTINCT person FROM "ScandalCatalog" WHERE person IS NOT NULL AND person LIKE '% %'`) as unknown as Promise<Array<{ person: string }>>,
      db.select({ name: schema.politicalResignations.name })
        .from(schema.politicalResignations)
        .where(eq(schema.politicalResignations.reviewStatus, 'approved')),
      db.select({ personName: schema.courtVerdicts.personName }).from(schema.courtVerdicts),
    ]);
    for (const r of scandalPersons) if (r.person) names.add(r.person.toLowerCase());
    for (const r of resignations) if (r.name && r.name.includes(' ')) names.add(r.name.toLowerCase());
    for (const r of verdicts) if (r.personName && r.personName.includes(' ')) names.add(r.personName.toLowerCase());
  } catch {
    // DB unavailable — the config-derived + static names above still apply.
  }

  return Array.from(names);
}
