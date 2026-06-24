import type { Metadata } from 'next';
import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { CrossLemondosok, CrossUgyek, CrossGaleria, CrossFelszolitottak } from '../_home/cross-promo';

export const revalidate = 120;

export const metadata: Metadata = {
  title: 'Megszűnt-e már?',
  description: 'Nyomon követjük a NER propagandamédiájának felszámolását — melyik szűnt meg, melyik él még.',
  openGraph: { title: 'Megszűnt-e már? — Kegyencjárat', description: 'A NER propagandamédiumainak felszámolása nyomon követve.' },
};

function typeLabel(t: string): string {
  if (t === 'megszűnés') return '✕ Megszűnés';
  if (t === 'leépítés') return '↓ Leépítés';
  if (t === 'elmaradt esemény') return '⊘ Elmaradt esemény';
  if (t === 'egyéb') return '◈ Intézményi';
  return t;
}

function typeColor(t: string): string {
  if (t === 'megszűnés') return '#E31937';
  if (t === 'leépítés') return '#FF9D00';
  if (t === 'elmaradt esemény') return '#4B7AFF';
  if (t === 'egyéb') return '#888';
  return '#666';
}

export default async function MegszuntPage() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.mediaClosures)
    .orderBy(desc(schema.mediaClosures.eventDate))
    .limit(200);

  const megszuntCount = rows.filter(r => r.eventType === 'megszűnés').length;
  const leepitesCount = rows.filter(r => r.eventType === 'leépítés').length;
  const mediaCount = megszuntCount + leepitesCount;

  return (
    <div className="news-section-wrap">
      <section className="section" id="megszunt">
        <div className="section-head">
          <div className="section-num">/ Médiaváltozások</div>
          <h2 className="section-title">Megszűnt-e már?</h2>
        </div>

        <p className="rogues-deck" style={{ marginTop: 24, marginBottom: 32, color: 'var(--ink)' }}>
          NER-közeli médiumok, műsorok és rendezvények, amelyek 2026. április 12.
          óta megszűntek, leépítések áldozataivá váltak, vagy elmaradtak.
        </p>

        <div className="megszunt-stats megszunt-stats--3">
          <div className="megszunt-stat">
            <div className="megszunt-stat-value">{mediaCount}</div>
            <div className="megszunt-stat-label">Érintett médium összesen</div>
          </div>
          <div className="megszunt-stat">
            <div className="megszunt-stat-value megszunt-stat-value--red">{megszuntCount}</div>
            <div className="megszunt-stat-label">Teljes megszűnés</div>
          </div>
          <div className="megszunt-stat">
            <div className="megszunt-stat-value megszunt-stat-value--orange">{leepitesCount}</div>
            <div className="megszunt-stat-label">Leépítés / tömeges kirúgás</div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 32 }}>
            Nincs adat.
          </div>
        ) : (
          <div className="res-table-wrap" style={{ marginTop: 32 }}>
            <table style={{ width: '100%', minWidth: 640, fontSize: '14px', lineHeight: '1.6' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <th className="res-col-date" style={{ textAlign: 'left', padding: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>Dátum</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Típus</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Médium / Esemény</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, minWidth: 220 }}>Leírás</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Forrás</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td className="res-col-date" style={{ padding: '12px', color: '#666', whiteSpace: 'nowrap' }}>
                      {new Date(r.eventDate).toLocaleDateString('hu-HU')}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: `${typeColor(r.eventType)}20`,
                          color: typeColor(r.eventType),
                          fontSize: '12px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {typeLabel(r.eventType)}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: '12px', color: '#666', minWidth: 320, fontSize: 13 }}>
                      {r.description ?? '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13 }}>
                      {r.sourceUrl ? (
                        <a
                          href={r.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                        >
                          {r.sourceName ?? 'Forrás'}
                        </a>
                      ) : (
                        <span style={{ color: '#999' }}>{r.sourceName ?? '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </section>

      <div className="cross-promo-section">
        <div className="cross-promo-section-inner">
          <CrossLemondosok />
          <CrossFelszolitottak />
          <CrossUgyek />
          <CrossGaleria />
        </div>
      </div>
    </div>
  );
}
