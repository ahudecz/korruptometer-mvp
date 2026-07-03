import Link from 'next/link';
import { gte } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db';
import { findBreakingForName, type BreakingArticle } from '@/lib/breaking';
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

function WatchCard({ person, breakingArticle }: { person: WatchPerson; breakingArticle?: BreakingArticle | null }) {
  const isGone = person.status !== 'active';
  return (
    <Link href={`/lemondasok/${person.id}`} className={`watchlist-card ${isGone ? 'watchlist-card--gone' : ''}`}>
      {breakingArticle && (
        <span className="watchlist-breaking-tag">
          <span className="watchlist-breaking-dot" />
          BREAKING
        </span>
      )}
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

export async function WatchlistGrid({ breaking = [] }: { breaking?: BreakingArticle[] }) {
  const db = getDb();
  const since = new Date('2026-04-12');

  const resignations = await db
    .select({ name: schema.politicalResignations.name, resignationType: schema.politicalResignations.resignationType })
    .from(schema.politicalResignations)
    .where(gte(schema.politicalResignations.resignationDate, since));

  const persons = WATCH_LIST.map(p => {
    const dynamicStatus = resolveStatus(resignations, p.name);
    return dynamicStatus !== 'active' ? { ...p, status: dynamicStatus } : p;
  });

  return (
    <div className="watchlist-grid">
      {persons.map(p => (
        <WatchCard key={p.id} person={p} breakingArticle={findBreakingForName(p.name, breaking)} />
      ))}
    </div>
  );
}
