import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { SiteFooter } from './site-footer';
import { NavMobile } from './nav-mobile';
import { CookieBanner } from './_home/cookie-banner';

import './globals.css';

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.startsWith('http')
  ? process.env.NEXT_PUBLIC_APP_URL
  : 'https://korruptometer.vercel.app';

const HOME_TITLE = 'Kegyencjárat — NER összeomlás tracker';
const HOME_DESCRIPTION =
  'Független, közforrású adatbázis a magyarországi korrupciós ügyekről és a NER összeomlásáról — adatokra, nem szólamokra alapozva.';

export const metadata: Metadata = {
  title: {
    default: HOME_TITLE,
    template: '%s — Kegyencjárat',
  },
  description: HOME_DESCRIPTION,
  metadataBase: new URL(appUrl),
  openGraph: {
    siteName: 'Kegyencjárat',
    type: 'website',
    locale: 'hu_HU',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
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
              <Image
                src="/images/brand/logo-wordmark.png"
                alt="Kegyencjárat"
                width={180}
                height={45}
                priority
                className="brand-logo"
              />
            </Link>
            <ul className="nav-links" aria-label="Fő navigáció">
              <li>
                <Link href="/galeria">Galéria</Link>
              </li>
              <li>
                <Link href="/ugyek">Kiemelt ügyek</Link>
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
                <Link href="/birosagi-iteletek">Börtönben van-e?</Link>
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
        <CookieBanner />
      </body>
    </html>
  );
}
