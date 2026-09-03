import { redirect } from 'next/navigation';

import { getDb } from '@/lib/db';
import { listQuizzes } from '@/lib/quiz-queries';

export const dynamic = 'force-dynamic';

/** /kviz → a legfrissebb kvízre irányít. */
export default async function KvizIndexPage() {
  const quizzes = await listQuizzes(getDb());
  const current = quizzes[0];
  if (!current) {
    return (
      <div className="poll-empty-state">
        <p>Jelenleg nincs elérhető kvíz.</p>
      </div>
    );
  }
  redirect(`/kviz/${current.slug}`);
}
