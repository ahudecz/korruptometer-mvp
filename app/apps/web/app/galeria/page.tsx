import Link from 'next/link';
import { asc, desc, eq } from 'drizzle-orm';

import { fmtFt } from '@korr/shared/format';
import { Mugshot } from '@korr/ui/mugshot';

import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Hair = 'short' | 'bald' | 'wave' | 'cap' | 'slick';
type Detention = 'loose' | 'wanted' | 'busted' | 'pretrial' | 'investig';

export default async function GaleriaPage() {
  const db = getDb();
  const { cases, rogueProfiles } = schema;

  const rows = await db
    .select({ case: cases, rogue: rogueProfiles })
    .from(cases)
    .leftJoin(rogueProfiles, eq(rogueProfiles.caseId, cases.id))
    .orderBy(desc(cases.amount), asc(cases.id))
    .limit(10);

  return (
    <section className="rogues" id="rogues">
      <div className="rogues-inner">
        <div className="section-head">
          <div className="section-num">02 / Galéria</div>
          <h2 className="section-title">A tíz legnagyobb.</h2>
        </div>
        <p className="rogues-deck">
          A legtöbbet ellopó tíz alany — sorrendben, dokumentált kár szerint. Aki{' '}
          <span className="red">rács mögött van</span>, BUSTED. Aki <b>menekül</b>,
          körözött. Aki szabadlábon várja a tárgyalást, megtalálható.
        </p>

        <div className="rogues-key">
          <div className="k">
            <span className="dot busted"></span> Elítélve · börtönben
          </div>
          <div className="k">
            <span className="dot pretrial"></span> Előzetes letartóztatásban
          </div>
          <div className="k">
            <span className="dot loose"></span> Szabadlábon · tárgyalás alatt
          </div>
          <div className="k">
            <span className="dot wanted"></span> Körözött · menekül
          </div>
          <div className="k">
            <span className="dot investig"></span> Vizsgálat alatt
          </div>
        </div>

        <div className="rogues-grid">
          {rows.map(({ case: c, rogue: r }, idx) => {
            const detention: Detention = (r?.detention as Detention) ?? 'loose';
            const isBusted = detention === 'busted';
            const isWanted = detention === 'wanted';
            const rank = String(idx + 1).padStart(2, '0');
            return (
              <Link
                key={c.id}
                href={`/adatbazis/${c.id}`}
                className={`rogue r-${detention}`}
                style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
              >
                <div className="rogue-rank">
                  <span>№ {rank}</span>
                  <span className="id">{c.id}</span>
                </div>
                <div className={`rogue-mug ${isBusted ? 'desat' : ''}`}>
                  <div className="corner-tag">
                    № {c.id} / {rank}
                  </div>
                  <Mugshot
                    caseId={c.id}
                    name={c.name}
                    variant={r?.variant ?? 0}
                    glasses={r?.glasses ?? false}
                    hair={(r?.hair as Hair) ?? 'short'}
                    detention={detention}
                  />
                  {isBusted && (
                    <>
                      <div className="stamp">BUSTED</div>
                      <div className="face-cross"></div>
                    </>
                  )}
                  {isWanted && <div className="stamp small">WANTED</div>}
                  <div className={`status-strip ${detention}`}>
                    {r?.detentionLabel ?? '—'}
                  </div>
                </div>
                <div className="rogue-name">{c.name}</div>
                <div className="rogue-pos">
                  {c.position} · {c.region} · {c.caseYear}
                </div>
                <div className="rogue-tags">
                  {(r?.crimes ?? []).slice(0, 3).map((cr) => (
                    <span key={cr} className="tag">
                      {cr}
                    </span>
                  ))}
                </div>
                <div className="rogue-amount">
                  <span className="lbl">Gyanúsítva</span>
                  <span className="val">{fmtFt(c.amount)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
