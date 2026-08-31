'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type PollSidebarItem = {
  slug: string;
  questionText: string;
  status: 'open' | 'closed';
  totalVotes: number;
};

/**
 * Szavazások közti váltó — desktopon álló oldalsáv, mobilon vízszintesen
 * görgethető csík (a főoldali "Kiemelt ügyek" váltogatás mintájára).
 */
export function PollSidebar({ polls }: { polls: PollSidebarItem[] }) {
  const pathname = usePathname();

  if (polls.length <= 1) return null;

  return (
    <nav className="poll-sidebar" aria-label="Szavazások">
      <span className="poll-sidebar-label">Szavazások</span>
      <ul className="poll-sidebar-list">
        {polls.map((poll) => {
          const href = `/szavazas/${poll.slug}`;
          const active = pathname === href;
          return (
            <li key={poll.slug}>
              <Link href={href} className={`poll-sidebar-item${active ? ' poll-sidebar-item--active' : ''}`}>
                <span className={`poll-sidebar-status poll-sidebar-status--${poll.status}`}>
                  {poll.status === 'open' ? 'Aktív' : 'Lezárt'}
                </span>
                <span className="poll-sidebar-question">{poll.questionText}</span>
                <span className="poll-sidebar-votes">{poll.totalVotes} szavazat</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
