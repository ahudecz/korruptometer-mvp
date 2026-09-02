import { and, eq, gte } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { WATCH_LIST, type WatchPerson } from '../../app/_home/watchlist-config';

/**
 * Egyetlen, megosztott forrás a WATCH_LIST dinamikus (DB-vel felülbírált)
 * státuszához — a `detect-watchlist-removals` cron (2+ független forrás)
 * a `WatchlistRemoval` táblát írja, ez felülbírálja a statikus
 * `watchlist-config.ts` `status` mezőjét. Korábban ezt a logikát
 * `watchlist-grid.tsx` és `/lemondasok/[id]` külön-külön implementálta —
 * a `cross-promo.tsx`-beli `CrossFelszolitottak` és az
 * `/lemondasok/[id]/opengraph-image.tsx` viszont kimaradt belőle, ezért
 * csak a statikus (elavult) `status`-t mutatták (user report, 2026-09-01:
 * "csak Koltay van kipirosozva", pedig Sulyok/Nagy Gábor Bálint/Polt is
 * eltávozott már). Minden ÚJ, WATCH_LIST-et renderelő helynek EZT a
 * függvényt kell hívnia, nem közvetlenül a WATCH_LIST-et.
 */
function resolveStatusFromResignations(
  dbResignations: { name: string; resignationType: string }[],
  personName: string,
): WatchPerson['status'] {
  const parts = personName.toLowerCase().split(' ').filter((p) => p.length > 2);
  const match = dbResignations.find((r) => {
    if (r.resignationType === 'Hivatalban van' || r.resignationType === 'egyéb') return false;
    const rn = r.name.toLowerCase();
    return parts.every((part) => rn.includes(part));
  });
  if (!match) return 'active';
  return match.resignationType === 'lemondás' ? 'resigned' : 'removed';
}

export async function resolveWatchListPersons(
  db: ReturnType<typeof getDb>,
): Promise<WatchPerson[]> {
  const since = new Date('2026-04-12');

  // Try/catch: a WatchlistRemoval tábla a 0038 migráció lefuttatásáig nem
  // létezik éles DB-n — enélkül a védelem nélkül egy hiányzó tábla az EGÉSZ
  // nyitóoldalt ledöntötte (2026-07-10).
  let dbRemovals: (typeof schema.watchlistRemovals.$inferSelect)[] = [];
  try {
    dbRemovals = await db.select().from(schema.watchlistRemovals);
  } catch {
    dbRemovals = [];
  }

  const resignations = await db
    .select({ name: schema.politicalResignations.name, resignationType: schema.politicalResignations.resignationType })
    .from(schema.politicalResignations)
    .where(
      and(
        gte(schema.politicalResignations.resignationDate, since),
        eq(schema.politicalResignations.reviewStatus, 'approved'),
      ),
    );
  const removalByPersonId = new Map(dbRemovals.map((r) => [r.personId, r]));

  return WATCH_LIST.map((p) => {
    const dbRemoval = removalByPersonId.get(p.id);
    if (dbRemoval) {
      return { ...p, status: dbRemoval.removalType === 'resigned' ? ('resigned' as const) : ('removed' as const) };
    }
    const dynamicStatus = resolveStatusFromResignations(resignations, p.name);
    return dynamicStatus !== 'active' ? { ...p, status: dynamicStatus } : p;
  });
}

/** Egyetlen személy dinamikus státusza — pl. OG-képhez, ahol csak egy id kell. */
export async function resolveWatchListPersonStatus(
  db: ReturnType<typeof getDb>,
  personId: string,
): Promise<WatchPerson | undefined> {
  const persons = await resolveWatchListPersons(db);
  return persons.find((p) => p.id === personId);
}
