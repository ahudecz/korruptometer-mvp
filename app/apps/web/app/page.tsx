import Link from 'next/link';
import { eq } from 'drizzle-orm';

import { fmtFt, fmtNumber } from '@korr/shared/format';
import { frissitveRelative } from '@korr/shared/relative-time';
import { Donut, type DonutSlice } from '@korr/ui/donut';

import { getDb, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SECTOR_PALETTE = [
  '#e31937',
  '#171a20',
  '#5c5e62',
  '#9b9da1',
  '#cccccc',
  '#e6e6e6',
];

type SectorEntry = { name: string; value: number };

export default async function HomePage() {
  const db = getDb();
  const snapshot = await db.query.kpiSnapshots.findFirst({
    where: eq(schema.kpiSnapshots.id, 'singleton'),
  });

  if (!snapshot) {
    return (
      <section className="section">
        <h2>Hiányzó adatok</h2>
        <p>
          A KpiSnapshot szabálysértésből nem érhető el. Kérjük, futtasd újra a
          seed scriptet (<code>pnpm --filter @korr/db db:seed</code>).
        </p>
      </section>
    );
  }

  const bySector = (snapshot.bySector ?? []) as SectorEntry[];
  const moneyDonut: DonutSlice[] = bySector.map((entry, i) => ({
    label: entry.name,
    value: entry.value,
    color: SECTOR_PALETTE[i % SECTOR_PALETTE.length]!,
  }));

  const fresh = frissitveRelative(snapshot.computedAt);

  return (
    <>
      <section className="hero">
        <div className="hero-eyebrow">Korruptométer</div>
        <h1>
          Magyar korrupció,
          <br />
          <span className="accent">számokkal.</span>
        </h1>
        <p className="lede">
          Független, közhitelű adatbázis a magyarországi korrupciós ügyekről —
          érintett összegekkel, kiszabott börtönévekkel, szektorbontással és
          forrásmegjelöléssel. Az adatok közvetlenül a fő szerkesztőség munkájából
          származnak; a freshness-jelző soha nem mutat optimistábban, mint
          amennyire valós.
        </p>
        <div className="hero-cta-row">
          <Link href="/adatbazis" className="btn btn-primary">
            Tovább az adatbázishoz
          </Link>
          <Link href="/galeria" className="btn btn-ghost">
            Rogues’ Gallery
          </Link>
        </div>
        <p style={{ marginTop: 24, color: 'var(--muted)', fontSize: 13 }} aria-live="polite">
          {fresh} · adatbázis-kép #{snapshot.id}
        </p>
      </section>

      <section className="section">
        <div className="section-eyebrow">Hős számok</div>
        <h2>Az adatbázis pillanatképe.</h2>
        <div className="kpi-grid">
          <div className="kpi">
            <div className="label">Összes érintett kár</div>
            <div className="value">{fmtFt(BigInt(snapshot.totalDamage))}</div>
            <div className="delta">A 12 nyilvántartott ügyből összesen.</div>
          </div>
          <div className="kpi">
            <div className="label">Kiszabott börtönévek</div>
            <div className="value">{fmtNumber(snapshot.totalPrisonYears)}</div>
            <div className="delta">Halmozott szabadságvesztés.</div>
          </div>
          <div className="kpi">
            <div className="label">Aktív ügyek</div>
            <div className="value">{fmtNumber(snapshot.activeCases)}</div>
            <div className="delta">Folyamatban lévő + vádemelés.</div>
          </div>
          <div className="kpi">
            <div className="label">Új vádemelések</div>
            <div className="value">
              {fmtNumber(snapshot.newIndictmentsThisWeek)}
            </div>
            <div className="delta">Összes vádemelés státuszú ügy.</div>
          </div>
          <div className="kpi">
            <div className="label">Forrás-partnerek</div>
            <div className="value">{fmtNumber(snapshot.partnerCount)}</div>
            <div className="delta">Aktív hírforrás a Phase 3-tól.</div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-eyebrow">Szektorbontás</div>
        <h2>Hova folyik a kár?</h2>
        <p className="lede">
          Az érintett összegek szektoronként. A donutot kattintással nem
          szűrhető — itt csak a megoszlás látszik; a részletes szűréshez ugorj
          az adatbázisra.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 1fr',
            gap: 32,
            alignItems: 'center',
          }}
        >
          <Donut slices={moneyDonut} ariaLabel="Érintett kár szektoronként" />
          <div>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 8 }}>
              {moneyDonut.map((slice) => (
                <li
                  key={slice.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--line)',
                    paddingBottom: 6,
                    fontSize: 14,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: slice.color,
                      }}
                    />
                    {slice.label}
                  </span>
                  <strong>{fmtFt(BigInt(Math.round(slice.value)))}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
