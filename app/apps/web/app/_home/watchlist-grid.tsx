import { WATCH_LIST, type WatchPerson } from './watchlist-config';

const STATUS_LABEL: Record<string, string> = {
  active: '● Hivatalban van',
  resigned: '↓ Lemondott',
  removed: '✕ Eltávolítva',
};

function imgSrc(url: string) {
  if (url.startsWith('/') || url.includes('wikimedia.org')) return url;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2);
}

function WatchCard({ person }: { person: WatchPerson }) {
  const isGone = person.status !== 'active';
  return (
    <div className={`watchlist-card ${isGone ? 'watchlist-card--gone' : ''}`}>
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
          <div className="watchlist-photo-credit">Fotó: {person.photoCredit}</div>
        )}
      </div>
      <div className="watchlist-info">
        <div className="watchlist-name">{person.name}</div>
        <div className="watchlist-institution">{person.institution}</div>
      </div>
    </div>
  );
}

export function WatchlistGrid() {
  return (
    <div className="watchlist-grid">
      {WATCH_LIST.map(p => (
        <WatchCard key={p.id} person={p} />
      ))}
    </div>
  );
}
