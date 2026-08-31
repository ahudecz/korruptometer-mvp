import { unstable_cache } from 'next/cache';
import Link from 'next/link';

import { fmtNumber } from '@korr/shared/format';

/**
 * Teljes szélességű, kitört promó-csík a hero fejléc/KPI-blokkja és a
 * KPI-kártyarács között (l. page.tsx) — szándékosan NEM a breaking-banner
 * mellett/alatt, hogy ne tűnjön úgy, mintha azt váltaná le (user report,
 * 2026-08-31). Az egész csík link a /szavazas-ra.
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

export async function PollBanner() {
  let totalVotes = 0;
  try {
    totalVotes = await getCachedPollTotalVotes();
  } catch {
    // ha a lekérdezés hibázik, a csík akkor is megjelenik szám nélkül
  }

  return (
    <Link href="/szavazas" className="poll-banner">
      <div className="poll-banner-inner">
        <span className="poll-banner-eyebrow">Szavazás</span>
        <p className="poll-banner-headline">
          Szavazz: mi legyen az első 5 ügy, amit a Vagyonvisszaszerzési Hivatal kivizsgál?
        </p>
        <div className="poll-banner-bottom">
          {totalVotes > 0 ? (
            <span className="poll-banner-count">{fmtNumber(totalVotes)} szavazat eddig</span>
          ) : (
            <span className="poll-banner-count">Légy te az első szavazó</span>
          )}
          {/* span, nem külön link — a teljes csík már link, egy beágyazott
              <a> érvénytelen HTML lenne */}
          <span className="poll-banner-cta">
            Szavazok <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
