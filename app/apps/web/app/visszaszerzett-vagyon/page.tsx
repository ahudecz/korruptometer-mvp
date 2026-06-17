import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { UGYEK } from '../_home/ugyek-config';

export const dynamic = 'force-dynamic';

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
}

function fmtFt(n: bigint): string {
  const v = Number(n);
  if (v >= 1_000_000_000) {
    const b = Math.floor((v / 1_000_000_000) * 10) / 10;
    return `${b.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} Mrd Ft`;
  }
  if (v >= 1_000_000) return `${Math.floor(v / 1_000_000)} M Ft`;
  return `${v.toLocaleString('hu-HU')} Ft`;
}

function firstSentence(text: string): string {
  const m = text.match(/^[^.!?]+[.!?]/);
  return m ? m[0].trim() : text.slice(0, 120).trim();
}

export default async function VisszaszerzettVagyonPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const byAmount = sort === 'amount';

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.assetRecoveries)
    .orderBy(
      byAmount
        ? desc(schema.assetRecoveries.amountFt)
        : desc(schema.assetRecoveries.recoveredAt),
    );

  // Group by caseId for the top section
  const caseMap = new Map<string, { caseId: string; totalFt: bigint; count: number }>();
  for (const r of rows) {
    if (!caseMap.has(r.caseId)) {
      caseMap.set(r.caseId, { caseId: r.caseId, totalFt: 0n, count: 0 });
    }
    const g = caseMap.get(r.caseId)!;
    g.totalFt += r.amountFt;
    g.count++;
  }
  const topCases = Array.from(caseMap.values())
    .sort((a, b) => Number(b.totalFt - a.totalFt))
    .slice(0, 8);

  const totalAll = rows.reduce((s, r) => s + r.amountFt, 0n);

  const thStyle = {
    textAlign: 'left' as const,
    padding: '10px 12px',
    fontWeight: 700,
    color: 'var(--ink)',
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  };

  return (
    <div className="news-section-wrap">
      <section className="section" id="visszaszerzett-vagyon">
        <div className="section-head">
          <div className="section-num">/ Elszámoltatás</div>
          <h2 className="section-title">Visszaszerzett vagyon</h2>
        </div>

        <p className="rogues-deck" style={{ marginTop: 24, marginBottom: 40, color: 'var(--ink)' }}>
          Az eljárások során visszautalt, visszavont vagy visszakövetelt közpénzek nyilvántartása.
          Összesen: <strong>{totalAll > 0n ? fmtFt(totalAll) : 'folyamatban'}</strong> — frissül
          az ügyek előrehaladásával.
        </p>

        {/* Top cases by recovered amount */}
        {topCases.length > 0 && (
          <div className="visszaszerzett-cases">
            {topCases.map((g, i) => {
              const ugy = UGYEK.find(u => u.id === g.caseId);
              const eyebrow = ugy ? ugy.eyebrow.split('·')[0].trim() : 'Ügy';
              const title = ugy?.title ?? g.caseId;
              const oneLiner = ugy ? firstSentence(ugy.summary) : '';
              const crimes = ugy?.crimeTypes?.slice(0, 2) ?? [];
              return (
                <Link
                  key={g.caseId}
                  href={`/ugyek/${g.caseId}`}
                  className="visszaszerzett-case-card"
                >
                  <div className="visszaszerzett-card-top">
                    <span className="visszaszerzett-rank">№ {String(i + 1).padStart(2, '0')}</span>
                    <span className="visszaszerzett-eyebrow">{eyebrow}</span>
                  </div>
                  <div className="visszaszerzett-case-title">{title}</div>
                  {oneLiner && (
                    <p className="visszaszerzett-case-desc">{oneLiner}</p>
                  )}
                  {crimes.length > 0 && (
                    <div className="visszaszerzett-case-crimes">
                      {crimes.map(c => (
                        <span key={c} className="tag tag-sm">{c}</span>
                      ))}
                    </div>
                  )}
                  <div className="visszaszerzett-case-footer">
                    <div className="visszaszerzett-case-footer-lbl">Visszaszerzett vagyon összesen</div>
                    <div className="visszaszerzett-case-total">{fmtFt(g.totalFt)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Sortable table */}
        <div style={{ marginTop: 56, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Összes visszaszerzési tétel
          </h3>
          <Link
            href="/visszaszerzett-vagyon"
            style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
              border: '1px solid var(--line)',
              background: !byAmount ? 'var(--ink)' : 'var(--surface)',
              color: !byAmount ? '#fff' : 'var(--muted)',
              textDecoration: 'none',
            }}
          >
            Legfrissebb
          </Link>
          <Link
            href="/visszaszerzett-vagyon?sort=amount"
            style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
              border: '1px solid var(--line)',
              background: byAmount ? 'var(--ink)' : 'var(--surface)',
              color: byAmount ? '#fff' : 'var(--muted)',
              textDecoration: 'none',
            }}
          >
            Legnagyobb összeg
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">Még nincs rögzített visszaszerzés.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '14px', lineHeight: '1.6', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)' }}>
                  <th style={thStyle}>Dátum</th>
                  <th style={thStyle}>Ügy</th>
                  <th style={thStyle}>Leírás</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Összeg</th>
                  <th style={thStyle}>Forrás</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? '#fff' : 'var(--surface)' }}>
                    <td style={{ padding: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(r.recoveredAt)}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--ink)' }}>{r.caseLabel}</td>
                    <td style={{ padding: '12px', color: 'var(--muted)', maxWidth: 340 }}>{r.description}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{fmtFt(r.amountFt)}</td>
                    <td style={{ padding: '12px' }}>
                      {r.sourceUrl ? (
                        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)', fontSize: 12 }}>
                          {r.sourceName ?? 'Forrás'} →
                        </a>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 32, borderTop: '1px solid var(--line)', paddingTop: 20, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
          Az adatok sajtójelentéseken és nyilvánosan hozzáférhető dokumentumokon alapulnak.
          A visszaszerzett összegek az eljárások előrehaladásával változhatnak.
        </div>
      </section>
    </div>
  );
}
