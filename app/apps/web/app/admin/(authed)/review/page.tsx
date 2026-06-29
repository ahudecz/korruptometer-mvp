import { desc, eq } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { ReviewButtons } from './review-buttons';

export const dynamic = 'force-dynamic';

const cell = { padding: '10px 12px', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' as const };
const th = { textAlign: 'left' as const, padding: '10px 12px', fontWeight: 600, fontSize: 12, color: '#666', borderBottom: '1px solid #e5e5e5' };

function fmt(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString('hu-HU') : '—';
}

export default async function ReviewPage() {
  await requireAdmin();
  const db = getDb();

  const [resignations, closures, verdicts] = await Promise.all([
    db.select().from(schema.politicalResignations)
      .where(eq(schema.politicalResignations.reviewStatus, 'pending'))
      .orderBy(desc(schema.politicalResignations.resignationDate)),
    db.select().from(schema.mediaClosures)
      .where(eq(schema.mediaClosures.reviewStatus, 'pending'))
      .orderBy(desc(schema.mediaClosures.eventDate)),
    db.select().from(schema.courtVerdicts)
      .where(eq(schema.courtVerdicts.reviewStatus, 'pending'))
      .orderBy(desc(schema.courtVerdicts.verdictDate)),
  ]);

  const total = resignations.length + closures.length + verdicts.length;

  return (
    <>
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">Adminisztráció · Detektálás</div>
          <h1 className="admin-title">Jóváhagyásra vár</h1>
          <p className="admin-sub">
            A detektorok által felajánlott, de nem auto-publikált találatok. Az „Elfogad" után
            megjelenik a nyilvános oldalon; az „Eldob" után nem jelenik meg és újra sem kerül elő.
          </p>
        </div>
        <div className="admin-count">{total} elem</div>
      </header>

      {total === 0 && (
        <div className="empty-state" style={{ marginTop: 24 }}>Nincs jóváhagyásra váró elem. 🎉</div>
      )}

      {resignations.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
            Lemondások / kirúgások / felmentések ({resignations.length})
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Dátum</th><th style={th}>Típus</th><th style={th}>Név</th><th style={th}>Pozíció</th><th style={th}>Intézmény</th><th style={th}>Művelet</th></tr></thead>
              <tbody>
                {resignations.map((r) => (
                  <tr key={r.id}>
                    <td style={cell}>{fmt(r.resignationDate)}</td>
                    <td style={cell}>{r.resignationType}</td>
                    <td style={{ ...cell, fontWeight: 500 }}>{r.name}</td>
                    <td style={cell}>{r.position}</td>
                    <td style={cell}>{r.institution}</td>
                    <td style={cell}><ReviewButtons table="resignation" id={r.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {closures.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
            Médiamegszűnések / leépítések ({closures.length})
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Dátum</th><th style={th}>Típus</th><th style={th}>Név</th><th style={th}>Leírás</th><th style={th}>Művelet</th></tr></thead>
              <tbody>
                {closures.map((m) => (
                  <tr key={m.id}>
                    <td style={cell}>{fmt(m.eventDate)}</td>
                    <td style={cell}>{m.eventType}</td>
                    <td style={{ ...cell, fontWeight: 500 }}>{m.name}</td>
                    <td style={{ ...cell, maxWidth: 280 }}>{m.description ?? '—'}</td>
                    <td style={cell}><ReviewButtons table="closure" id={m.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {verdicts.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
            Bírósági ítéletek / előzetes letartóztatások ({verdicts.length})
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Dátum</th><th style={th}>Típus</th><th style={th}>Név</th><th style={th}>Összegzés</th><th style={th}>Művelet</th></tr></thead>
              <tbody>
                {verdicts.map((v) => (
                  <tr key={v.id}>
                    <td style={cell}>{fmt(v.verdictDate)}</td>
                    <td style={cell}>{v.verdictType}</td>
                    <td style={{ ...cell, fontWeight: 500 }}>{v.personName}</td>
                    <td style={{ ...cell, maxWidth: 280 }}>{v.summary}</td>
                    <td style={cell}><ReviewButtons table="verdict" id={v.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
