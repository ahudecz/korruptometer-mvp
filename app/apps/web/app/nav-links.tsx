'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 2026-09-16 — a Galéria lekerült a DESKTOP navigációból (user kérés): a
// nyolcadik elemtől a sor tördelni kezdett, és a hosszabb címkék
// ("Kiemelt ügyek", "Börtönben van-e?") két sorba csúsztak. A Galéria
// továbbra is elérhető a mobil menüből, a láblécből, a nyitóoldali 07-es
// szekcióból és a kereszt-promókból, tehát nem lesz árva oldal.
const NAV_LINKS = [
  { href: '/rendszervaltas', label: 'Dicsőségfal' },
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
