import { redirect } from 'next/navigation';

import { getDb } from '@/lib/db';
import { listPolls } from '@/lib/poll-queries';

export const dynamic = 'force-dynamic';

/** /szavazas → a legfrissebb nyitott (vagy ha nincs, a legfrissebb) szavazásra irányít. */
export default async function SzavazasIndexPage() {
  const polls = await listPolls(getDb());
  const current = polls.find((p) => p.status === 'open') ?? polls[0];
  if (!current) {
    return (
      <div className="poll-empty-state">
        <p>Jelenleg nincs elérhető szavazás.</p>
      </div>
    );
  }
  redirect(`/szavazas/${current.slug}`);
}
