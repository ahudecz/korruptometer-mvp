import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { UGYEK } from '../_home/ugyek-config';
import { FtValue } from '../_home/ft-value';
import { RecoveryRow, stopRowClick, type RecoveryRowTarget } from './recovery-row';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Visszaszerzett vagyon',
  description: 'Nyomon követjük a NER-korszakban eltűnt, majd visszaszerzett közpénzt és vagyont — esetenként, összeggel.',
};

const HU_MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

// Kerek, jelképes cél — nem mérés, hanem viszonyítási pont ahhoz, mekkora
// része térült meg a NER-korszak becsült közvagyon-károkozásának.
const RECOVERY_GOAL_FT = 1_000_000_000_000n; // 1000 milliárd Ft

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`;
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
  const caseMap = new Map<string, { caseId: string; caseLabel: string; description: string; sourceUrl: string | null; totalFt: bigint; count: number }>();
  for (const r of rows) {
    if (!caseMap.has(r.caseId)) {
      caseMap.set(r.caseId, { caseId: r.caseId, caseLabel: r.caseLabel, description: r.description, sourceUrl: r.sourceUrl, totalFt: 0n, count: 0 });
    }
    const g = caseMap.get(r.caseId)!;
    g.totalFt += r.amountFt;
    g.count++;
  }
  const topCases = Array.from(caseMap.values())
    .sort((a, b) => Number(b.totalFt - a.totalFt))
    .slice(0, 8);

  const totalAll = rows.reduce((s, r) => s + r.amountFt, 0n);
  const recoveryPct = Number(totalAll) / Number(RECOVERY_GOAL_FT) * 100;
  // A csík maga a valós %-ot mutatja, de kap egy minimális látható szélességet
  // (0,6%) is, hogy ne tűnjön el teljesen a sáv elején egy kis összegnél.
  const recoveryBarWidth = totalAll > 0n ? Math.min(100, Math.max(recoveryPct, 0.6)) : 0;

  return (
    <div className="news-section-wrap">
      <section className="section" id="visszaszerzett-vagyon">
        <div className="section-head">
          <div className="section-num">/ Elszámoltatás</div>
          <h2 className="section-title">Visszaszerzett vagyon</h2>
        </div>

        <p className="rogues-deck" style={{ marginTop: 24, marginBottom: 40, color: 'var(--ink)' }}>
          Az eljárások során visszautalt, visszavont vagy visszakövetelt közpénzek nyilvántartása.
          Összesen: <strong>{totalAll > 0n ? <FtValue n={totalAll} /> : 'folyamatban'}</strong> — frissül
          az ügyek előrehaladásával.
        </p>

        <div className="recovery-tracker">
          <div className="recovery-tracker-head">
            <div className="recovery-tracker-label">Visszaszerzett vagyon számláló</div>
            <div className="recovery-tracker-goal">Jelképes cél: <FtValue n={RECOVERY_GOAL_FT} mode="long" /></div>
          </div>
          <div className="recovery-tracker-track">
            <div className="recovery-tracker-fill" style={{ width: `${recoveryBarWidth}%` }} />
          </div>
          <div className="recovery-tracker-stats">
            <span className="recovery-tracker-current"><FtValue n={totalAll} /></span>
            <span className="recovery-tracker-pct">{recoveryPct.toFixed(2)}% a célból</span>
          </div>
        </div>

        {/* Top cases by recovered amount */}
        {topCases.length > 0 && (
          <div className="visszaszerzett-cases">
            {topCases.map((g, i) => {
              const ugy = UGYEK.find(u => u.id === g.caseId);
              const eyebrow = ugy ? (ugy.eyebrow.split('·')[0] ?? '').trim() : 'Ügy';
              // No curated /ugyek/ page for this case yet — show the case's
              // own name instead of the raw caseId slug, and don't link
              // anywhere (the route would 404). The LLM's caseLabel often
              // bakes the amount in after a "-"/"·" separator (see
              // slugifyCaseLabel) — drop that part here too, so the card
              // title reads like a case name ("NKA botrány"), not a sentence.
              const title = ugy?.title ?? (g.caseLabel.split(/[-·]/)[0] ?? g.caseLabel).trim();
              // Mindig legyen rövid leírás a kártyán: a curált /ugyek/ oldal
              // saját összefoglalója, vagy ennek hiányában az AssetRecovery
              // sor description mezője (kötelező, sose üres — l. schema.ts).
              const oneLiner = firstSentence(ugy ? ugy.summary : g.description);
              const crimes = ugy?.crimeTypes?.slice(0, 2) ?? [];
              const cardBody = (
                <>
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
                    <div className="visszaszerzett-case-total"><FtValue n={g.totalFt} /></div>
                  </div>
                </>
              );
              if (ugy) {
                return (
                  <Link key={g.caseId} href={`/ugyek/${g.caseId}`} className="visszaszerzett-case-card">
                    {cardBody}
                  </Link>
                );
              }
              // No curated /ugyek/ page yet — link out to the source article
              // instead of a would-be-404 /ugyek/ route.
              return g.sourceUrl ? (
                <a key={g.caseId} href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="visszaszerzett-case-card">
                  {cardBody}
                </a>
              ) : (
                <div key={g.caseId} className="visszaszerzett-case-card">
                  {cardBody}
                </div>
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
            scroll={false}
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
            scroll={false}
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
            <table className="db-table">
              <thead>
                <tr>
                  <th>Dátum</th>
                  <th>Ügy</th>
                  <th>Leírás</th>
                  <th className="num">Összeg</th>
                  <th>Forrás</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ugy = UGYEK.find((u) => u.id === r.caseId);
                  // Ha van ügy-végoldal, a sor oda visz — a forrás-cella
                  // ilyenkor a kivétel, ami mégis a cikkre megy. Ha nincs
                  // ügy-végoldal, a sor maga a cikkre visz (ha van forrás-URL).
                  const target: RecoveryRowTarget = ugy
                    ? { type: 'internal', href: `/ugyek/${r.caseId}` }
                    : r.sourceUrl
                      ? { type: 'external', href: r.sourceUrl }
                      : { type: 'none' };
                  return (
                    <RecoveryRow key={r.id} target={target}>
                      <td data-label="Dátum" style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(r.recoveredAt)}</td>
                      <td data-label="Ügy">
                        {ugy ? (
                          <Link href={`/ugyek/${r.caseId}`} className="case-name" onClick={stopRowClick}>
                            {r.caseLabel}
                          </Link>
                        ) : (
                          <span className="case-name">{r.caseLabel}</span>
                        )}
                      </td>
                      <td data-label="Leírás" style={{ color: 'var(--muted)', maxWidth: 340 }}>{r.description}</td>
                      <td className="num db-damage-cell" data-label="Összeg"><FtValue n={r.amountFt} /></td>
                      <td data-label="Forrás">
                        {r.sourceUrl ? (
                          <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={stopRowClick} style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {r.sourceName ?? 'Forrás'} →
                          </a>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </RecoveryRow>
                  );
                })}
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
