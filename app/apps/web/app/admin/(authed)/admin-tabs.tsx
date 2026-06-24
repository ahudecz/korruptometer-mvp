'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin', label: 'Sor' },
  { href: '/admin/news', label: 'Hírek' },
  { href: '/admin/social-posts', label: 'Social posztok' },
  { href: '/admin/scraper-runs', label: 'Scraperek' },
  { href: '/admin/resignations', label: 'Lemondások' },
  { href: '/admin/media-closures', label: 'Megszűnt-e?' },
  { href: '/admin/kmonitor-persons', label: 'K-Monitor személyek' },
  { href: '/admin/kmonitor-tags', label: 'Címkék' },
  { href: '/admin/dsr', label: 'DSR' },
  { href: '/admin/editors', label: 'Szerkesztők' },
] as const;

export function AdminTabs() {
  const pathname = usePathname() ?? '';
  return (
    <ul className="admin-tabs" aria-label="Admin navigáció">
      {TABS.map((t) => {
        const isActive = t.href === '/admin' ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <li key={t.href}>
            <Link href={t.href} aria-current={isActive ? 'page' : undefined}>
              {t.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
