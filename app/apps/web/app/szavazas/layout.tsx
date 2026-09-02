import type { ReactNode } from 'react';

import { getDb } from '@/lib/db';
import { listPolls } from '@/lib/poll-queries';
import { PollSidebar } from './_components/poll-sidebar';
import { PollBottomPromo } from './_components/poll-bottom-promo';

export const metadata = {
  title: 'Szólj bele — Kegyencjárat',
  description:
    'Közösségi szavazások a NER-hez és a kormányváltáshoz kapcsolódó ügyekről — jelezd a közakaratot a kormány és az egyes szervek felé.',
};

export default async function SzavazasLayout({ children }: { children: ReactNode }) {
  const polls = await listPolls(getDb());

  return (
    <main className="poll-page">
      <div className="poll-section-header">
        <span className="poll-section-eyebrow">Szólj bele</span>
        <p className="poll-section-desc">
          Ezen az oldalon olyan kérdésekről szavazhatsz, amik a NER-hez és a kormányváltáshoz
          kapcsolódnak — így jelezheted a közakaratot a kormány és az egyes szervek felé. Minél
          többen szavaznak, annál komolyabb a jelzésértéke.
        </p>
      </div>
      <div className="poll-layout">
        <PollSidebar polls={polls} />
        <div className="poll-content">{children}</div>
      </div>
      <PollBottomPromo />
    </main>
  );
}
