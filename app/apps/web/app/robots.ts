import type { MetadataRoute } from 'next';

// 2026-09-15 — az oldalnak addig sem robots.txt-je, sem sitemap-je nem volt.
// DR 0-s domainnél ez a legolcsóbb nyereség: a crawl-budget nem megy el az
// admin- és API-útvonalakra, a sitemap pedig megmutatja a Googlenak azokat a
// mély végoldalakat, amikre alig mutat belső link (l. app/sitemap.ts).
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.startsWith('http')
  ? process.env.NEXT_PUBLIC_APP_URL
  : 'https://www.kegyencjarat.hu';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',          // bejelentkezéshez kötött szerkesztői felület
          '/api/',           // JSON-végpontok, semmi indexelnivaló
          '/auth/',          // OAuth callback
          '/hamarosan',      // már most is noindex metával
          '/whistleblower',  // bejelentői űrlap — ne gyűjtsön rá találatot
          '/bejelentes',
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
