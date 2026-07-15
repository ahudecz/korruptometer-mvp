'use client';

import { useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';

export type RecoveryRowTarget =
  | { type: 'internal'; href: string }
  | { type: 'external'; href: string }
  | { type: 'none' };

/** Whole-row clickable table row, mirroring adatbazis's CaseRow — but the
 *  target can be either an internal /ugyek/ case page or an external source
 *  article, depending on whether a curated case page exists for this row. */
export function RecoveryRow({ target, children }: { target: RecoveryRowTarget; children: ReactNode }) {
  const router = useRouter();
  const clickable = target.type !== 'none';

  function handleClick() {
    if (target.type === 'internal') router.push(target.href);
    else if (target.type === 'external') window.open(target.href, '_blank', 'noopener,noreferrer');
  }

  return (
    <tr className={clickable ? 'clickable-row' : undefined} onClick={clickable ? handleClick : undefined}>
      {children}
    </tr>
  );
}

/** Stops the source-cell link from also triggering the row's own navigation
 *  (relevant when the row itself targets the /ugyek/ case page, not the
 *  article — the source cell is the one exception that always goes to the article). */
export function stopRowClick(e: MouseEvent) {
  e.stopPropagation();
}
