import type { DescriptionBlock } from './ugyek-config';

type FacilitiesBlock = Extract<DescriptionBlock, { type: 'facilities' }>;
type ImageBlock = Extract<DescriptionBlock, { type: 'image' }>;
type TimelineBlock = Extract<DescriptionBlock, { type: 'timeline' }>;

/**
 * „Szolgáltatások”-rács, a szállásfoglaló oldalak mintájára: minden elem egy
 * ikon + rövid megnevezés (+ opcionális részlet). User kérés, 2026-10-01
 * (Hatvanpuszta): az eredeti tervek helyiséglistája ne sima felsorolás
 * legyen. A `planned` elem halványítva, „csak terv” címkével jelenik meg —
 * egy tervrajz nem bizonyítja, hogy a helyiség el is készült.
 */
export function FacilitiesGrid({ block }: { block: FacilitiesBlock }) {
  return (
    <section className="ugy-facilities" id={block.id}>
      {block.heading && <h2 className="ugy-block-heading">{block.heading}</h2>}
      {block.intro && <p className="ugy-facilities-intro">{block.intro}</p>}
      <ul className="ugy-facilities-grid">
        {block.items.map((it, i) => (
          <li key={i} className={`ugy-facility${it.planned ? ' ugy-facility--planned' : ''}`}>
            <span className="ugy-facility-icon" aria-hidden="true">{it.icon}</span>
            <span className="ugy-facility-text">
              <span className="ugy-facility-label">{it.label}</span>
              {it.detail && <span className="ugy-facility-detail">{it.detail}</span>}
              {it.planned && <span className="ugy-facility-badge">csak terv</span>}
            </span>
          </li>
        ))}
      </ul>
      {(block.note || block.sourceUrl) && (
        <p className="ugy-facilities-note">
          {block.note}
          {block.sourceUrl && (
            <>
              {block.note ? ' ' : ''}
              <a href={block.sourceUrl} target="_blank" rel="noopener noreferrer">
                {block.sourceLabel ?? 'Forrás'} →
              </a>
            </>
          )}
        </p>
      )}
    </section>
  );
}

/** Függőleges, összekötött idővonal — a Dicsőségfal idővonalának (rendszervaltas/
 *  [slug]/page.tsx Timeline) ügyoldali párja: vonal, pöttyök, piros dátum, alatta
 *  a mérföldkő. User kérés, 2026-10-01 (Hatvanpuszta). */
export function DescTimeline({ block }: { block: TimelineBlock }) {
  return (
    <section className="ugy-timeline-block">
      {block.heading && <h2 className="ugy-block-heading">{block.heading}</h2>}
      <ol className="ugy-timeline">
        {block.items.map((it) => (
          <li className="ugy-timeline-item" key={`${it.when}-${it.text}`}>
            <span className="ugy-timeline-dot" aria-hidden="true" />
            <span className="ugy-timeline-when">{it.when}</span>
            <span className="ugy-timeline-text">{it.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Egyetlen kép felirattal és forrásmegjelöléssel. */
export function DescImage({ block }: { block: ImageBlock }) {
  return (
    <figure className="ugy-block-image">
      {/* eslint-disable-next-line @next/next/no-img-element -- saját /public kép, ugyanúgy, mint az image-pair blokknál */}
      <img src={block.src} alt={block.alt} loading="lazy" className="ugy-block-image-img" />
      {(block.caption || block.credit) && (
        <figcaption className="ugy-block-image-caption">
          {block.caption}
          {block.credit && <span className="ugy-block-image-credit">{block.credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}
