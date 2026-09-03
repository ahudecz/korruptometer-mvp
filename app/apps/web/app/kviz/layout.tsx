import type { ReactNode } from 'react';

import { getDb } from '@/lib/db';
import { listQuizzes } from '@/lib/quiz-queries';
import { QuizSidebar } from './_components/quiz-sidebar';

export const metadata = {
  title: 'Kvízek — Kegyencjárat',
  description: 'Teszteld a tudásod a legnagyobb NER-botrányokról — feleletválasztós kvízek, azonnali visszajelzéssel.',
};

export default async function KvizLayout({ children }: { children: ReactNode }) {
  const quizzes = await listQuizzes(getDb());

  return (
    <main className="poll-page">
      <div className="poll-section-header">
        <span className="poll-section-eyebrow">Kvíz</span>
        <p className="poll-section-desc">
          Mennyire ismered a legnagyobb korrupciós ügyeket? Válaszolj a kérdésekre, és derítsd ki!
        </p>
      </div>
      <div className="poll-layout">
        <QuizSidebar quizzes={quizzes} />
        <div className="poll-content">{children}</div>
      </div>
    </main>
  );
}
