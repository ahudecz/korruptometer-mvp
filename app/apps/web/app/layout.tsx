import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '@korr/ui/site-footer';

import './globals.css';

export const metadata: Metadata = {
  title: 'Korruptométer — Magyarországi korrupció nyomon követése',
  description:
    'Független, közhitelű adatbázis a magyarországi korrupcióról: ügyek, vádlottak, pénzmozgás, médiavisszhang.',
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
        <header className="nav" role="banner">
          <div className="nav-inner">
            <Link href="/" className="brand">
              Korruptométer
            </Link>
            <nav aria-label="Fő navigáció">
              <ul className="nav-links">
                <li>
                  <Link href="/adatbazis">Adatbázis</Link>
                </li>
                <li>
                  <Link href="/galeria">Galéria</Link>
                </li>
                <li>
                  <Link href="/hirek">Hírek</Link>
                </li>
                <li>
                  <Link href="/hamarosan">Módszertan</Link>
                </li>
              </ul>
            </nav>
            <Link href="/bejelentes" className="nav-cta">
              Bejelentés
            </Link>
          </div>
        </header>
        <main id="fooldal">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
