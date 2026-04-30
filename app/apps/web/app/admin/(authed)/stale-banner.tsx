import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';

export async function StaleBanner() {
  const db = getDb();
  const rows = await db.execute<{ received_stale: number; in_review_stale: number }>(
    sql`SELECT received_stale, in_review_stale FROM submission_stale_counts`,
  );
  const first = (rows as unknown as Array<{ received_stale: number; in_review_stale: number }>)[0];
  const received = Number(first?.received_stale ?? 0);
  const inReview = Number(first?.in_review_stale ?? 0);
  const total = received + inReview;
  if (total === 0) return null;

  return (
    <div
      role="alert"
      style={{
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent)',
        color: 'var(--accent)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        fontSize: 14,
      }}
    >
      <strong>Stuck submissions:</strong> {received} a `received` állapotban &gt; 14 napja, {inReview} a
      `in_review` állapotban &gt; 30 napja. A napi GDPR-takarító digestben Slackre is megy.
    </div>
  );
}
