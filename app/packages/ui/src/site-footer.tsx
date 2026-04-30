import * as React from 'react';

const deferredLinks = [
  { href: '/hamarosan', label: 'Adatvédelem' },
  { href: '/hamarosan', label: 'Módszertan' },
  { href: '/hamarosan', label: 'Sajtó' },
  { href: '/hamarosan', label: 'Partnerek' },
  { href: '/hamarosan', label: 'Csapat' },
  { href: '/hamarosan', label: 'CSV / API export' },
  { href: '/hamarosan', label: 'Támogatás' },
];

export function SiteFooter() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer-inner">
        <div>
          <h4>Korruptométer</h4>
          <p style={{ color: 'var(--muted)', maxWidth: '40ch' }}>
            Független, közhitelű adatbázis a magyarországi korrupcióról.
            Az adatok nyilvános forrásokból származnak, szerkesztőségünk ellenőrzése után.
          </p>
        </div>
        <div>
          <h4>Tájékoztatás</h4>
          <ul>
            {deferredLinks.slice(0, 4).map((l) => (
              <li key={l.label}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Adat &amp; közösség</h4>
          <ul>
            {deferredLinks.slice(4).map((l) => (
              <li key={l.label}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
            <li>
              <a href="mailto:dpo@korruptometer.hu">dpo@korruptometer.hu</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="site-footer-inner bottom">
        <span>© {new Date().getFullYear()} Korruptométer</span>
        <span>HU · v0.1 · alpha</span>
      </div>
    </footer>
  );
}
