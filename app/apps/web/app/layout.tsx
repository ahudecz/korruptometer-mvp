import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '@korr/ui/site-footer';
import { NavMobile } from './nav-mobile';
import { FooterScrollFix } from './footer-scroll-fix';

import './globals.css';

export const metadata: Metadata = {
  title: 'KEGYENCJÁRAT — Magyarországi korrupció nyomon követése',
  description:
    'Független, közforrású adatbázis a Magyarországon dokumentált korrupciós ügyekről, a 2026. április 12-i rendszerváltás óta történt személyi változásokról és a propaganda megszűnéséről. Minden korrupciós eset nyomon követhető a vádemeléstől az ítéletig — adatokra, nem szólamokra alapozva.',
  metadataBase: new URL('http://localhost:3000'),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hu">
      <body>
        <a className="skip-link" href="#fooldal">
          Ugrás a fő tartalomra
        </a>
        <nav className="nav" role="banner">
          <div className="nav-inner">
            <Link href="/" className="brand">
              Kegyencjárat
            </Link>
            <ul className="nav-links" aria-label="Fő navigáció">
              <li>
                <Link href="/#dashboard">Áttekintés</Link>
              </li>
              <li>
                <Link href="/galeria">Galéria</Link>
              </li>
              <li>
                <Link href="/ugyek">Ügyek</Link>
              </li>
              <li>
                <Link href="/adatbazis">Adatbázis</Link>
              </li>
              <li>
                <Link href="/hirek">Hírek</Link>
              </li>
              <li>
                <Link href="/lemondasok">Lemondások</Link>
              </li>
              <li>
                <Link href="/megszunt">Megszűnt-e?</Link>
              </li>
              <li>
                <Link href="/bejelentes">Bejelentés</Link>
              </li>
            </ul>
            <Link href="/bejelentes" className="nav-cta">
              Bejelentés tétele
            </Link>
            <NavMobile />
          </div>
        </nav>
        <main id="fooldal">{children}</main>
        <SiteFooter />
        <FooterScrollFix />
      </body>
    </html>
  );
}
