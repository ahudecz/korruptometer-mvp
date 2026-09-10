import { getActiveBreaking } from '@/lib/breaking';
import { condenseBreakingHeadline } from '@/lib/breaking-headline';

export async function BreakingBanner() {
  const breaking = await getActiveBreaking();
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
