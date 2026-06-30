'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

/** Whole-row clickable table row. The inner case-name Link still works (and is
 *  crawlable); clicking anywhere else in the row navigates too. */
export function CaseRow({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr className="clickable-row" onClick={() => router.push(href)}>
      {children}
    </tr>
  );
}
