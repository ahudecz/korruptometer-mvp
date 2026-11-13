import Link from 'next/link';

import { detaineeHref, type DetaineeProfile } from './letartoztatottak-config';

/**
 * 2026-11-13, user kérés: a letartóztatottak aloldalai (/birosagi-iteletek/<slug>)
 * ne legyenek árva oldalak. Ugyanez a keretes doboz kerül a kapcsolódó kiemelt
 * ügy oldalára (pl. Volánbusz → Seszták) és a „Börtönben van-e?” lista tetejére.
 */
export function DetaineePromo({
  profiles,
  heading = 'Letartóztatva ebben az ügyben',
  note,
}: {
  profiles: DetaineeProfile[];
  heading?: string;
  note?: string;
}) {
  if (profiles.length === 0) return null;
  return (
    <section className="detainee-promo" aria-label={heading}>
      <div className="detainee-promo-head">
        <span className="detainee-promo-dot" aria-hidden="true" />
        <h2 className="detainee-promo-heading">{heading}</h2>
      </div>
      {note && <p className="detainee-promo-note">{note}</p>}
      <div className="detainee-promo-grid">
        {profiles.map((p) => (
          <Link key={p.slug} href={detaineeHref(p)} className="detainee-promo-card">
            <img src={p.photo} alt={p.photoAlt} className="detainee-promo-photo" loading="lazy" />
            <div className="detainee-promo-body">
              <span className="detainee-promo-status">{p.statusLabel}</span>
              <span className="detainee-promo-name">{p.name}</span>
              <span className="detainee-promo-sub">{p.subtitle}</span>
              <span className="detainee-promo-teaser">{p.teaser}</span>
              <span className="detainee-promo-cta">Miért tartóztatták le? →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
