import { unstable_cache } from 'next/cache';
import Link from 'next/link';

import { fmtNumber } from '@korr/shared/format';

/**
 * Külön, önálló async server component — szándékosan NEM a page.tsx nagy
 * Promise.all-jába ágyazva, hogy ne kockáztassa a meglévő, már törékeny
 * adatlekérési láncot (lásd a `getCachedClosureCount` melletti megjegyzést
 * a lefagyásokról). Saját cache-elt lekérdezéssel dolgozik.
 */
const getCachedPollTotalVotes = unstable_cache(
  async () => {
    const { getDb } = await import('@/lib/db');
    const { getPollWithResults } = await import('@/lib/poll-queries');
    const poll = await getPollWithResults(getDb(), 'nvvh-elso-5-ugye');
    return poll?.totalVotes ?? 0;
  },
  ['poll-total-votes'],
  { tags: ['poll-results'], revalidate: 60 },
);

export async function PollTeaserCard() {
  let totalVotes = 0;
  try {
    totalVotes = await getCachedPollTotalVotes();
  } catch {
    // ha a lekérdezés hibázik, a kártya akkor is megjelenik szám nélkül —
    // ne dőljön el emiatt a főoldal
  }

  return (
    <section className="poll-teaser-section">
      <Link href="/szavazas" className="poll-teaser-card">
        <div className="poll-teaser-eyebrow">Szavazás</div>
        <h2 className="poll-teaser-title">
          Mi legyen a Nemzeti Vagyonvisszaszerzési és Védelmi Hivatal első 5 ügye?
        </h2>
        <p className="poll-teaser-sub">
          Válaszd ki 1-5 ügyet a 30 legnagyobb, feltáratlan korrupciós eset közül.
        </p>
        <div className="poll-teaser-foot">
          <span className="poll-teaser-count">
            {totalVotes > 0 ? `${fmtNumber(totalVotes)} szavazat eddig` : 'Légy te az első szavazó'}
          </span>
          <span className="poll-teaser-cta">Szavazok →</span>
        </div>
      </Link>
    </section>
  );
}
