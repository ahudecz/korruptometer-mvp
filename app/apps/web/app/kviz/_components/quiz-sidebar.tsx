'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type QuizSidebarItem = {
  slug: string;
  title: string;
  questionCount: number;
};

/**
 * Kvízek közti váltó — a szavazás-oldalsáv (poll-sidebar.tsx) mintájára:
 * desktopon álló oldalsáv, mobilon vízszintesen görgethető csík. Csak akkor
 * jelenik meg, ha 1-nél több kvíz van (egy kvíznél felesleges).
 */
export function QuizSidebar({ quizzes }: { quizzes: QuizSidebarItem[] }) {
  const pathname = usePathname();

  if (quizzes.length <= 1) return null;

  return (
    <nav className="poll-sidebar" aria-label="Kvízek">
      <span className="poll-sidebar-label">Kvízek</span>
      <ul className="poll-sidebar-list">
        {quizzes.map((quiz) => {
          const href = `/kviz/${quiz.slug}`;
          const active = pathname === href;
          return (
            <li key={quiz.slug}>
              <Link href={href} className={`poll-sidebar-item${active ? ' poll-sidebar-item--active' : ''}`}>
                <span className="poll-sidebar-question">{quiz.title}</span>
                <span className="poll-sidebar-votes">{quiz.questionCount} kérdés</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
