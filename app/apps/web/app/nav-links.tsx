'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/galeria', label: 'Galéria' },
  { href: '/ugyek', label: 'Kiemelt ügyek' },
  { href: '/adatbazis', label: 'Adatbázis' },
  { href: '/hirek', label: 'Hírek' },
  { href: '/lemondasok', label: 'Lemondott-e?' },
  { href: '/birosagi-iteletek', label: 'Börtönben van-e?' },
  { href: '/megszunt', label: 'Megszűnt-e?' },
];

// Egy nav-elem akkor "aktív", ha a jelenlegi útvonal pontosan az övé, VAGY
// egy alatta lévő aloldalon vagyunk (pl. /adatbazis/[id], /lemondasok/[id])
// — sima előtag-egyezés, nem csak pontos találat.
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Desktop fő navigáció. Külön kliens-komponens (a layout.tsx maga szerver-
 * komponens marad) — az usePathname()-hez kell a 'use client', ugyanúgy,
 * ahogy a NavMobile is ezért kliens-komponens.
 */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <ul className="nav-links" aria-label="Fő navigáció">
      {NAV_LINKS.map(({ href, label }) => (
        <li key={href}>
          <Link href={href} aria-current={isActive(pathname, href) ? 'page' : undefined}>
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
