import Link from 'next/link';
import { asc, desc, eq } from 'drizzle-orm';

import { fmtFt } from '@korr/shared/format';
import { Mugshot } from '@korr/ui/mugshot';

import { getDb, schema } from '@/lib/db';

export const revalidate = 300;

type Hair = 'short' | 'bald' | 'wave' | 'cap' | 'slick';

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
    <section className="section">
      <div className="section-eyebrow">Rogues’ Gallery</div>
      <h2>A 10 legdrágább ügy.</h2>
      <p className="lede">
        Az adatbázis tíz legnagyobb érintett összegű ügye — érintettek
        állapotcímkéivel és vád­állomásukkal. A mugshot determinisztikus SVG: ugyanaz az
        ügy mindig pontosan ugyanezt a képet hozza vissza.
      </p>

      <div className="rogues-grid">
        {rows.map(({ case: c, rogue: r }, idx) => (
          <article key={c.id} className="rogue">
            <div className="rogue-rank">
              <span>№ {String(idx + 1).padStart(2, '0')}</span>
              <span className="case-id">{c.id}</span>
            </div>
            <Link
              href={`/adatbazis/${c.id}`}
              className={`rogue-mug ${r?.detention === 'busted' ? 'desat' : ''}`}
              style={{ display: 'block' }}
            >
              <Mugshot
                caseId={c.id}
                name={c.name}
                variant={r?.variant ?? 0}
                glasses={r?.glasses ?? false}
                hair={(r?.hair as Hair) ?? 'short'}
                detention={r?.detention ?? 'loose'}
              />
              <div className={`status-strip ${r?.detention ?? 'loose'}`}>
                {r?.detentionLabel ?? '—'}
              </div>
            </Link>
            <div className="rogue-name">{c.name}</div>
            <div className="rogue-pos">
              {c.position} · {c.region} · {c.caseYear}
            </div>
            <div className="rogue-tags">
              {(r?.crimes ?? []).map((cr) => (
                <span key={cr} className="tag">
                  {cr}
                </span>
              ))}
            </div>
            <div className="rogue-amount">
              <span className="lbl">Gyanúsítva</span>
              <span className="val">{fmtFt(c.amount)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
