import type { NextStepBannerDto } from '@korr/shared';

export function NextStepBanner({ banner }: { banner: NextStepBannerDto }) {
  return (
    <div className={`next-step-banner kind-${banner.kind}`} role="status">
      <span className="next-step-msg">{banner.messageHu}</span>
      {banner.actionHref && banner.actionLabelHu ? (
        <a className="next-step-action" href={banner.actionHref}>
          {banner.actionLabelHu}
        </a>
      ) : null}
    </div>
  );
}
