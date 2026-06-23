import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '@korr/ui/site-footer';
import { NavMobile } from './nav-mobile';
import { FooterScrollFix } from './footer-scroll-fix';
import { CookieBanner } from './_home/cookie-banner';

import './globals.css';

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.startsWith('http')
  ? process.env.NEXT_PUBLIC_APP_URL
  : 'https://korruptometer.vercel.app';

export const metadata: Metadata = {
  title: {
    default: 'KEGYENCJÁRAT — Magyarországi korrupció nyomon követése',
    template: '%s — Kegyencjárat',
  },
  description:
    'Független, közforrású adatbázis a Magyarországon dokumentált korrupciós ügyekről, a 2026. április 12-i rendszerváltás óta történt személyi változásokról és a propaganda megszűnéséről. Minden korrupciós eset nyomon követhető a vádemeléstől az ítéletig — adatokra, nem szólamokra alapozva.',
  metadataBase: new URL(appUrl),
  openGraph: {
    siteName: 'Kegyencjárat',
    type: 'website',
    locale: 'hu_HU',
    title: 'KEGYENCJÁRAT — Magyarországi korrupció nyomon követése',
    description:
      'Független, közforrású adatbázis a Magyarországon dokumentált korrupciós ügyekről — adatokra, nem szólamokra alapozva.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KEGYENCJÁRAT — Magyarországi korrupció nyomon követése',
    description:
      'Független, közforrású adatbázis a Magyarországon dokumentált korrupciós ügyekről — adatokra, nem szólamokra alapozva.',
  },
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
                <Link href="/lemondasok">Lemondott-e?</Link>
              </li>
              <li>
                <Link href="/megszunt">Megszűnt-e?</Link>
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
        <CookieBanner />
      </body>
    </html>
  );
}
