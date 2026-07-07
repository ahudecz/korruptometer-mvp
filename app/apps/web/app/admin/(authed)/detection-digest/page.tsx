import Link from 'next/link';

import { requireAdmin } from '@/lib/admin/auth';
import { loadMonthlyDigest, resolveMonth } from '@/lib/detection-digest';

export const dynamic = 'force-dynamic';

const cell = { padding: '10px 12px', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' as const };
const th = { textAlign: 'left' as const, padding: '10px 12px', fontWeight: 600, fontSize: 12, color: '#666', borderBottom: '1px solid #e5e5e5' };

const DETECTOR_LABELS: Record<string, string> = {
  resignation: 'Lemondás/kirúgás/felmentés',
  media_closure: 'Médiamegszűnés',
  court_verdict: 'Bírósági ítélet/előzetes',
  asset_recovery: 'Vagyonvisszaszerzés',
};

function fmt(d: Date): string {
  return new Date(d).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' });
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function DetectionDigestPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAdmin();
  const { month } = await searchParams;
  const range = resolveMonth(month);
  const digest = await loadMonthlyDigest(range);

  const prevMonth = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth() - 1, 1));
  const nextMonth = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth() + 1, 1));

  return (
    <>
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Adminisztráció · Detektálás</div>
          <h1 className="admin-title">Havi összefoglaló</h1>
          <p className="admin-sub">
            A 4 detektor (lemondás, médiamegszűnés, bírósági ítélet, vagyonvisszaszerzés) egy havi
            áttekintése — automatikusan publikált, jóváhagyásra váró, és a 0.70-es küszöb alatt, de
            nem elhanyagolhatóan (0.50 felett) eldobott „majdnem bekerült” esetek.
          </p>
        </div>
        <div className="admin-count">{range.label}</div>
      </header>

      <nav style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
        <Link href={`/admin/detection-digest?month=${monthKey(prevMonth)}`}>← Előző hónap</Link>
        <Link href={`/admin/detection-digest?month=${monthKey(nextMonth)}`}>Következő hónap →</Link>
      </nav>

      <section style={{ marginTop: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
          Automatikusan publikált ({digest.approved.length})
        </h2>
        {digest.approved.length === 0 ? (
          <div className="empty-state">Nincs ebben a hónapban.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Dátum</th><th style={th}>Név</th><th style={th}>Részlet</th></tr></thead>
              <tbody>
                {digest.approved.map((e) => (
                  <tr key={e.id}>
                    <td style={cell}>{fmt(e.date)}</td>
                    <td style={{ ...cell, fontWeight: 500 }}>{e.name}</td>
                    <td style={cell}>{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
          Jóváhagyásra vár ({digest.pending.length})
        </h2>
        {digest.pending.length === 0 ? (
          <div className="empty-state">Nincs ebben a hónapban.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Dátum</th><th style={th}>Név</th><th style={th}>Részlet</th><th style={th}></th></tr></thead>
              <tbody>
                {digest.pending.map((e) => (
                  <tr key={e.id}>
                    <td style={cell}>{fmt(e.date)}</td>
                    <td style={{ ...cell, fontWeight: 500 }}>{e.name}</td>
                    <td style={cell}>{e.detail}</td>
                    <td style={cell}><Link href="/admin/review">Elbírálás →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
          Majdnem bekerült, de eldobott ({digest.nearMiss.length})
        </h2>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 8px' }}>
          A megbízhatóság 0.50–0.6999 között volt — a review.ts 0.70-es küszöbe alapján helyesen
          eldobva, de közel eleget ahhoz, hogy érdemes legyen rájuk egy második pillantást vetni.
        </p>
        {digest.nearMiss.length === 0 ? (
          <div className="empty-state">Nincs ebben a hónapban.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Dátum</th><th style={th}>Típus</th><th style={th}>Név</th><th style={th}>Bizalom</th><th style={th}>Forráscikk</th></tr></thead>
              <tbody>
                {digest.nearMiss.map((e) => (
                  <tr key={e.id}>
                    <td style={cell}>{fmt(e.checkedAt)}</td>
                    <td style={cell}>{DETECTOR_LABELS[e.detectorType] ?? e.detectorType}</td>
                    <td style={{ ...cell, fontWeight: 500 }}>{e.name}</td>
                    <td style={cell}>{e.confidence.toFixed(2)}</td>
                    <td style={cell}>
                      {e.articleUrl ? (
                        <a href={e.articleUrl} target="_blank" rel="noreferrer">
                          {e.headline?.slice(0, 60) ?? 'Cikk megnyitása'} →
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
