'use client';

import { useEffect } from 'react';

export function FooterScrollFix() {
  useEffect(() => {
    const footer = document.querySelector('.site-footer');
    if (!footer) return;

    const handler = (e: MouseEvent) => {
      const a = (e.target as Element).closest('a[href]') as HTMLAnchorElement | null;
      if (a && !a.href.startsWith('mailto:') && a.hostname === location.hostname) {
        setTimeout(() => window.scrollTo(0, 0), 0);
      }
    };

    footer.addEventListener('click', handler as EventListener);
    return () => footer.removeEventListener('click', handler as EventListener);
  }, []);

  return null;
}
