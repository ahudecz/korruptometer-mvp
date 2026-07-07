'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  { href: '/legfontosabb-hangok', label: 'Legfontosabb hangok' },
];

export function NavMobile() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const overlay = (
    <div className="mobile-overlay" role="dialog" aria-modal="true" aria-label="Navigáció">
      <button
        className="mobile-close"
        aria-label="Menü bezárása"
        type="button"
        onClick={() => setOpen(false)}
      >
        ✕
      </button>
      <nav>
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="mobile-nav-link"
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Link href="/bejelentes" className="mobile-nav-cta" onClick={() => setOpen(false)}>
        Bejelentés tétele →
      </Link>
    </div>
  );

  return (
    <>
      <button
        className="hamburger"
        aria-label={open ? 'Menü bezárása' : 'Menü megnyitása'}
        aria-expanded={open}
        type="button"
        onClick={() => setOpen(v => !v)}
      >
        <span style={open ? { transform: 'rotate(45deg) translate(5px, 5px)' } : undefined} />
        <span style={open ? { opacity: 0 } : undefined} />
        <span style={open ? { transform: 'rotate(-45deg) translate(5px, -5px)' } : undefined} />
      </button>

      {mounted && open && createPortal(overlay, document.body)}
    </>
  );
}
