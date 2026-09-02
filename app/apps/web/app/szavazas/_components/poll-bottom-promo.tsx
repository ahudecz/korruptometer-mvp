import Link from 'next/link';

import { UGYEK } from '../../_home/ugyek-config';
import { CrossLemondosok, CrossMegszunt, CrossGaleria, CrossFelszolitottak } from '../../_home/cross-promo';

/**
 * A szavazóoldal alján megjelenő továbbterelő blokk — user report,
 * 2026-09-02: 99%-os bounce rate szavazás után, mert innen sehova nem
 * vezetett tovább az oldal. Az `/ugyek/[id]` (pl. NKA-botrány) oldal alján
 * meglévő mintát követi majdnem szó szerint (UGYEK-rács + a 4 cross-promo
 * blokk), csak az első blokk szövege más — itt nincs "aktuális ügy", amit
 * ki kéne zárni a rácsból, ezért mind a 30 UGYEK-elem megjelenik.
 */
export function PollBottomPromo() {
  return (
    <>
      <div className="person-more-section">
        <div className="person-more-inner">
          <div className="person-more-label poll-bottom-promo-label">
            <span className="poll-bottom-promo-title">Érdekel, hogy állnak a kiemelt ügyek?</span>
            <span className="poll-bottom-promo-sub">
              Nézd meg a legfrissebb híreket, feljelentéseket, letartóztatásokat!
            </span>
          </div>
          <div className="ugyek-more-grid">
            {UGYEK.map((e) => (
              <Link key={e.id} href={`/ugyek/${e.id}`} className="ugyek-more-card">
                <div className="ugyek-more-eyebrow">{(e.eyebrow.split('·')[0] ?? '').trim()}</div>
                <div className="ugyek-more-title">{e.title}</div>
                {e.responsible && <div className="ugyek-more-sub">{e.responsible}</div>}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="cross-promo-below-more">
        <div className="cross-promo-below-more-inner">
          <CrossLemondosok />
          <CrossGaleria />
          <CrossMegszunt />
          <CrossFelszolitottak />
        </div>
      </div>
    </>
  );
}
