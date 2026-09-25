import { unstable_cache } from 'next/cache';

import { getActiveBreaking } from '@/lib/breaking';
import { condenseBreakingHeadline } from '@/lib/breaking-headline';

// 2026-09-26: ugyanaz a cache-kulcs, mint a page.tsx getCachedActiveBreaking-jé,
// így a csík nem indít külön, gyorsítótár nélküli DB-lekérdezést minden
// nyitóoldal-kiszolgálásnál (az időszakos 504 egyik oka).
const getCachedActiveBreaking = unstable_cache(getActiveBreaking, ['active-breaking'], { revalidate: 60 });

export async function BreakingBanner() {
  const breaking = await getCachedActiveBreaking();
  const latest = breaking[0];
  if (!latest) return null;

  // 2026-09-10 (user jelzés): a NewsArticle.headline több forrásnál a
  // lead-bekezdés, nem a cím — a csík így ~77 szót írt ki, ami mobilon a
  // képernyő felét kitakarta. 20 szavas kemény korlát, teljes tagmondatra
  // tömörítve (l. breaking-headline.ts).
  const { text } = condenseBreakingHeadline(latest.headline);

  return (
    <div className="breaking-banner" role="alert">
      <span className="breaking-banner-dot" aria-hidden="true" />
      <span className="breaking-banner-label">BREAKING</span>
      <span className="breaking-banner-sep">—</span>
      <a
        href={latest.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="breaking-banner-link"
        // A teljes eredeti szöveg elérhető marad hover/olvasóprogram számára,
        // a csík maga viszont rövid.
        title={latest.headline}
      >
        {text}
      </a>
    </div>
  );
}
