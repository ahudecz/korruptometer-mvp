import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { WatchlistGrid } from '../_home/watchlist-grid';
import { CrossMegszunt, CrossUgyek, CrossGaleria } from '../_home/cross-promo';

export const revalidate = 120;

function typeLabel(t: string): string {
  if (t === 'lemondás') return '↓ Lemondás';
  if (t === 'kirúgás') return '✕ Kirúgás';
  if (t === 'felmentés') return '⟲ Felmentés';
  return t;
}

function typeColor(t: string): string {
  if (t === 'lemondás') return '#4B7AFF';
  if (t === 'kirúgás') return '#E31937';
  if (t === 'felmentés') return '#FF9D00';
  return '#666';
}

const cellStyle = { padding: '12px', color: '#666' } as const;

function Row({ r }: { r: Awaited<ReturnType<typeof fetchRows>>[number] }) {
  const color = typeColor(r.resignationType);
  return (
    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
      <td className="res-col-date" style={{ ...cellStyle, whiteSpace: 'nowrap' as const }}>
        {new Date(r.resignationDate).toLocaleDateString('hu-HU')}
      </td>
      <td style={{ ...cellStyle, whiteSpace: 'nowrap' as const }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: `${color}20`,
          color,
          fontSize: '12px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {typeLabel(r.resignationType)}
        </span>
      </td>
      <td style={{ ...cellStyle, fontWeight: 500, color: 'var(--ink)' }}>{r.name}</td>
      <td style={cellStyle}>{r.position}</td>
      <td className="res-col-institution" style={cellStyle}>{r.institution}</td>
      <td className="res-col-desc" style={{ ...cellStyle, maxWidth: 320, fontSize: 13 }}>{r.description ?? '—'}</td>
    </tr>
  );
}

async function fetchRows() {
  const db = getDb();
  return db
    .select()
    .from(schema.politicalResignations)
    .orderBy(desc(schema.politicalResignations.resignationDate))
    .limit(100);
}

const tableHead = (
  <thead>
    <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
      <th className="res-col-date" style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Dátum</th>
      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Státusz</th>
      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Név</th>
      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Pozíció</th>
      <th className="res-col-institution" style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Intézmény</th>
      <th className="res-col-desc" style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Leírás</th>
    </tr>
  </thead>
);

export default async function LemondasokPage() {
  const rows = await fetchRows();
  const rest = rows.filter(r => !r.pinned);

  return (
    <div className="news-section-wrap">
      <section className="section" id="lemondasok">
        <div className="section-head">
          <div className="section-num">/ Személyi változások</div>
          <h2 className="section-title">Lemondott-e már?</h2>
        </div>

        <p className="rogues-deck" style={{ marginTop: 24, marginBottom: 0, color: 'var(--ink)' }}>
          Magyar Péter lemondásra szólította fel a NER kulcsintézményeinek vezetőit — ha valamelyikük
          távozik, a kártyáján megjelenik. Lemondásra szólította fel Sulyok Tamás köztársasági elnököt,
          valamint azokat, akiket ő a rendszer tartóoszlopainak nevez: a Kúria elnökét, az
          Alkotmánybíróság elnökét, a legfőbb ügyészt, az Állami Számvevőszék elnökét, a Gazdasági
          Versenyhivatal elnökét, a Médiahatóság elnökét és az Országos Bírói Hivatal elnökét.
        </p>

        <WatchlistGrid />

        {rest.length > 0 && (
          <>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              marginTop: '48px',
              marginBottom: '16px',
              paddingTop: '24px',
              borderTop: '1px solid #e5e5e5',
              color: 'var(--ink)',
            }}>
              Legfrissebb lemondások, kirúgások és felmentések
            </h2>
            <div className="res-table-wrap">
              <table style={{ width: '100%', minWidth: 700, fontSize: '14px', lineHeight: '1.6' }}>
                {tableHead}
                <tbody>
                  {rest.map(r => <Row key={r.id} r={r} />)}
                </tbody>
              </table>
            </div>
          </>
        )}

        {rows.length === 0 && (
          <div className="empty-state" style={{ marginTop: 32 }}>Nincs adat.</div>
        )}
      </section>

      <div className="cross-promo-section">
        <div className="cross-promo-section-inner">
          <CrossMegszunt />
          <CrossUgyek />
          <CrossGaleria />
        </div>
      </div>
    </div>
  );
}
