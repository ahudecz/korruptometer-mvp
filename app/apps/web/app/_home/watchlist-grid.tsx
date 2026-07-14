import Link from 'next/link';
import { gte } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { WATCH_LIST, type WatchPerson } from './watchlist-config';

const STATUS_LABEL: Record<string, string> = {
  active: '● Hivatalban van',
  resigned: 'LEMONDOTT',
  removed: 'ELTÁVOLÍTVA',
};

function imgSrc(url: string) {
  if (url.startsWith('/') || url.includes('wikimedia.org')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2);
}

function resolveStatus(
  dbResignations: { name: string; resignationType: string }[],
  personName: string,
): WatchPerson['status'] {
  const parts = personName.toLowerCase().split(' ').filter(p => p.length > 2);
  const match = dbResignations.find(r => {
    if (r.resignationType === 'Hivatalban van' || r.resignationType === 'egyéb') return false;
    const rn = r.name.toLowerCase();
    return parts.every(part => rn.includes(part));
  });
  if (!match) return 'active';
  return match.resignationType === 'lemondás' ? 'resigned' : 'removed';
}

// 2026-07-14 — used to also show a BREAKING tag (name-matched against the
// active breaking pool) on 'active' (still-in-office) cards. Removed:
// while someone is still 'active' by definition their whole story is an
// unresolved, ongoing saga (that's why they're on this list) — any
// matching article is just the latest chapter of the same thing, so a
// keyword-based "is this really new" filter kept losing to the next day's
// headline (Sulyok Tamás case). The /lemondasok TABLE's own breaking
// indicator (resignation-list.tsx) is unaffected — that's tied to an
// actual PoliticalResignation row, not a name-match against any story.
function WatchCard({ person }: { person: WatchPerson }) {
  const isGone = person.status !== 'active';
  return (
    <Link href={`/lemondasok/${person.id}`} className={`watchlist-card ${isGone ? 'watchlist-card--gone' : ''}`}>
      <div className="watchlist-photo">
        {person.photoUrl ? (
          <img
            src={imgSrc(person.photoUrl)}
            alt={person.name}
            className="watchlist-photo-img"
            style={person.objectPosition ? { objectPosition: person.objectPosition } : undefined}
          />
        ) : (
          <div className="watchlist-photo-placeholder">
            <span>{initials(person.name)}</span>
          </div>
        )}
        <div className={`watchlist-badge watchlist-badge--${person.status}`}>
          {STATUS_LABEL[person.status]}
        </div>
        {person.photoCredit && (
          <div className="watchlist-photo-credit">{person.photoCredit}</div>
        )}
      </div>
      <div className="watchlist-info">
        <div className="watchlist-name">{person.name}</div>
        <div className="watchlist-institution">{person.institution}</div>
        <div className="watchlist-cta">{isGone ? 'Miért kellett mennie? →' : 'Miért kell mennie? →'}</div>
      </div>
    </Link>
  );
}

export async function WatchlistGrid() {
  const db = getDb();
  const since = new Date('2026-04-12');

  // detect-watchlist-removals.ts (2+ független forrás megerősítése) — ez
  // felülbírálja a WATCH_LIST statikus status mezőjét, ugyanúgy ahogy a
  // /lemondasok/[id] végoldal is teszi. Try/catch: a WatchlistRemoval tábla
  // a 0038 migráció lefuttatásáig nem létezik éles DB-n — enélkül a védelem
  // nélkül egy hiányzó tábla az EGÉSZ nyitóoldalt ledöntötte (2026-07-10).
  let dbRemovals: (typeof schema.watchlistRemovals.$inferSelect)[] = [];
  try {
    dbRemovals = await db.select().from(schema.watchlistRemovals);
  } catch {
    dbRemovals = [];
  }

  const resignations = await db
    .select({ name: schema.politicalResignations.name, resignationType: schema.politicalResignations.resignationType })
    .from(schema.politicalResignations)
    .where(gte(schema.politicalResignations.resignationDate, since));
  const removalByPersonId = new Map(dbRemovals.map((r) => [r.personId, r]));

  const persons = WATCH_LIST.map(p => {
    const dbRemoval = removalByPersonId.get(p.id);
    if (dbRemoval) return { ...p, status: dbRemoval.removalType === 'resigned' ? 'resigned' as const : 'removed' as const };
    const dynamicStatus = resolveStatus(resignations, p.name);
    return dynamicStatus !== 'active' ? { ...p, status: dynamicStatus } : p;
  });

  return (
    <div className="watchlist-grid">
      {persons.map(p => (
        <WatchCard key={p.id} person={p} />
      ))}
    </div>
  );
}
