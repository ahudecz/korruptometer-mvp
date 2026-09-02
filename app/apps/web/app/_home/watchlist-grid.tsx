import Link from 'next/link';

import { getDb } from '@/lib/db';
import { resolveWatchListPersons } from '@/lib/watchlist-status';
import { type WatchPerson } from './watchlist-config';

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
  const persons = await resolveWatchListPersons(db);

  return (
    <div className="watchlist-grid">
      {persons.map(p => (
        <WatchCard key={p.id} person={p} />
      ))}
    </div>
  );
}
