import { getActiveBreaking } from '@/lib/breaking';

export async function BreakingBanner() {
  const breaking = await getActiveBreaking();
  const latest = breaking[0];
  if (!latest) return null;

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
      >
        {latest.headline}
      </a>
    </div>
  );
}
