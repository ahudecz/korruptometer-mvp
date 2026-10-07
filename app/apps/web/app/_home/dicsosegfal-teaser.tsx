import Link from 'next/link';

import { FELTAROK } from './rendszervaltas-config';
import styles from '../rendszervaltas/dicsosegfal.module.css';

// Nyitóoldali beharangozó a /rendszervaltas Dicsőségfalhoz. Szándékosan
// külön komponens és nem inline blokk a page.tsx-ben: azt a fájlt több
// munkamenet is szerkeszti párhuzamosan, egy 60 soros beszúrás ott
// garantált ütközés. A teljes rács a saját oldalán van.
//
// 2026-10-07, user kérés: fix, kézzel választott 10 név, 2×5-ös rácsban
// (desktopon 5 oszlop, mobilon 2 oszlop / 5 sor). Első sor személyek,
// második sor műhelyek és csatornák — ebben a sorrendben.
const TEASER_IDS = [
  'hadhazy-akos', 'puzser-robert', 'panyi-szabolcs', 'molnar-aron', 'juhasz-peter',
  'atlatszo', 'gulyasagyu-media', 'pottyondy-edina', 'videki-prokator', 'direkt36',
];

function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function DicsosegfalTeaser() {
  const shown = TEASER_IDS.flatMap((id) => FELTAROK.filter((f) => f.id === id));

  return (
    <section className="section" id="dicsosegfal">
      <div className="section-head">
        <div className="section-num">08 / Dicsőségfal</div>
        <h2 className="section-title">Akiknek köszönhetjük.</h2>
      </div>
      <p className="section-partner-note">
        A Galéria tükörképe: oknyomozó újságírók, adat-aktivisták, képviselők és civil
        műhelyek, akiknek a munkájából ez az egész adatbázis összeállt.
      </p>

      <div className={`${styles.grid} ${styles.gridFive}`}>
        {shown.map((f) => {
          const inner = (
            <>
              <div className={styles.photo}>
                {f.photo ? (
                  <img
                    src={f.photo}
                    alt={`${f.name} — ${f.role}`}
                    className={styles.photoImg}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className={styles.placeholder} aria-hidden="true">{initials(f.name)}</div>
                )}
                <div className={styles.badge}>{f.badge}</div>
              </div>
              <div className={styles.info}>
                <div className={styles.name}>{f.name}</div>
                <div className={styles.role}>{f.role}</div>
              </div>
            </>
          );
          return f.live ? (
            <Link key={f.id} href={`/rendszervaltas/${f.id}`} className={styles.card}>{inner}</Link>
          ) : (
            <div key={f.id} className={styles.card}>{inner}</div>
          );
        })}
      </div>

      <div className="rogues-footer">
        <Link href="/rendszervaltas" className="rogues-more-btn">
          Mind a {FELTAROK.length} név és a történetük →
        </Link>
      </div>
    </section>
  );
}
