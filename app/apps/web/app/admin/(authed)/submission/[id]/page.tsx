import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { fmtDate, fmtFt } from '@korr/shared/format';
import { decryptPii } from '@korr/shared/encryption';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { SubmissionActions } from './submission-actions';

export const dynamic = 'force-dynamic';

type Status = 'received' | 'in_review' | 'approved' | 'rejected' | 'duplicate';

const STATUS_LABEL: Record<Status, string> = {
  received: 'Beérkezett',
  in_review: 'Vizsgálat alatt',
  approved: 'Jóváhagyva',
  rejected: 'Elutasítva',
  duplicate: 'Duplikátum',
};

const STATUS_BADGE: Record<Status, 'pending' | 'approved' | 'rejected'> = {
  received: 'pending',
  in_review: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  duplicate: 'rejected',
};

export default async function AdminSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireEditor();
  const db = getDb();
  const submission = await db.query.submissions.findFirst({
    where: eq(schema.submissions.id, id),
  });
  if (!submission) notFound();

  const attachments = await db
    .select()
    .from(schema.submissionAttachments)
    .where(eq(schema.submissionAttachments.submissionId, id));

  // FR-049 / SC-015: every PII decryption writes a pii.read audit row in the
  // SAME transaction context (here we write before reading so a crash mid-render
  // still leaves the trail).
  let reporterEmail: string | null = null;
  let reporterName: string | null = null;
  if (submission.reporterEmailEnc || submission.reporterNameEnc) {
    await db.insert(schema.auditLogs).values({
      actorEditorId: session.editor.id,
      action: 'pii.read',
      entityType: 'Submission',
      entityId: submission.id,
      detail: { ref: submission.ref },
    });
    if (submission.reporterEmailEnc) {
      reporterEmail = decryptPii(submission.reporterEmailEnc);
    }
    if (submission.reporterNameEnc) {
      reporterName = decryptPii(submission.reporterNameEnc);
    }
  }

  const sealedBoxOnly = !submission.summary && !!submission.bodyCipher;
  const status = submission.status as Status;

  return (
    <>
      <header className="admin-head">
        <div>
          <div className="admin-eyebrow">
            <Link href="/admin" style={{ color: 'inherit' }}>
              ← Vissza a sorhoz
            </Link>
            {'  ·  '}Bejelentés
          </div>
          <h1
            className="admin-title"
            style={{ fontFamily: 'Archivo Narrow, monospace', fontSize: 'clamp(36px, 4vw, 56px)' }}
          >
            {submission.ref}
          </h1>
          <p className="admin-sub">
            Beérkezett <strong>{fmtDate(submission.createdAt)}</strong>. Forrás:{' '}
            {submission.anonymous ? 'névtelen bejelentő' : 'azonosítható bejelentő'}
            {submission.bodyCipher && (
              <>
                {' · '}
                <strong>sealed-box</strong> mód aktív
              </>
            )}
            .
          </p>
        </div>
        <div className="admin-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <span className={`state-badge ${STATUS_BADGE[status]}`}>
            <span className="dot" />
            {STATUS_LABEL[status] ?? status}
          </span>
          <span>Szerkesztő: <strong>{session.email}</strong></span>
        </div>
      </header>

      <section className="stat-ribbon" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-cell">
          <span className="label">Gyanúsított</span>
          <span className="value" style={{ fontSize: 22 }}>
            {submission.suspectName}
          </span>
          <span className="delta">A bejelentésben szereplő név</span>
        </div>
        <div className="stat-cell">
          <span className="label">Pozíció</span>
          <span className="value" style={{ fontSize: 16, fontWeight: 600 }}>
            {submission.suspectPosition ?? '—'}
          </span>
          <span className="delta">{submission.suspectPosition ? 'megadva' : 'nincs megadva'}</span>
        </div>
        <div className="stat-cell">
          <span className="label">Régió</span>
          <span className="value" style={{ fontSize: 16, fontWeight: 600 }}>
            {submission.suspectRegion ?? '—'}
          </span>
          <span className="delta">{submission.suspectRegion ? 'megadva' : 'nincs megadva'}</span>
        </div>
        <div className="stat-cell is-accent">
          <span className="label">Becsült érintett</span>
          <span className="value" style={{ fontSize: 26 }}>
            {submission.estimatedAmount != null ? fmtFt(submission.estimatedAmount) : '—'}
          </span>
          <span className="delta">A bejelentés szerinti összeg</span>
        </div>
      </section>

      <section className="detail-section" style={{ padding: '28px 0', borderBottom: 0 }}>
        <h4>Cselekmények</h4>
        <div className="chip-group">
          {(submission.crimes ?? []).length === 0 ? (
            <span className="chip" style={{ color: 'var(--muted)' }}>
              Nincs megjelölve
            </span>
          ) : (
            (submission.crimes ?? []).map((c) => (
              <span className="chip" key={c}>
                {c}
              </span>
            ))
          )}
        </div>
      </section>

      <section className="detail-section" style={{ padding: '0 0 28px', borderBottom: 0 }}>
        <h4>Összefoglaló</h4>
        {sealedBoxOnly ? (
          <div className="chart-empty">
            Sealed-box mód aktív — a tartalom titkosítva, csak a böngészőben
            olvasható egy szerkesztői privát kulccsal. (Phase 4 teljes UI a US15
            implementációja után érhető el.)
          </div>
        ) : (
          <p
            style={{
              background: 'var(--surface)',
              padding: 16,
              borderRadius: 4,
              whiteSpace: 'pre-wrap',
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {submission.summary ?? '(üres)'}
          </p>
        )}
      </section>

      {(reporterEmail || reporterName || submission.allowContact) && (
        <section className="detail-section" style={{ padding: '0 0 28px', borderBottom: 0 }}>
          <h4>
            Elérhetőség <span className="aside">titkosítva tárolva</span>
          </h4>
          {reporterEmail || reporterName ? (
            <>
              <div className="chip-group">
                {reporterName && (
                  <span className="chip">
                    Név: <strong style={{ marginLeft: 4 }}>{reporterName}</strong>
                  </span>
                )}
                {reporterEmail && (
                  <span className="chip">
                    E-mail: <strong style={{ marginLeft: 4 }}>{reporterEmail}</strong>
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>
                Ennek az olvasásnak a tényét a <code>pii.read</code> AuditLog-bejegyzés
                örökre megőrzi.
              </p>
            </>
          ) : (
            <div className="chart-empty" role="status">
              A reporter PII-jét a megőrzési szabály alapján töröltük. A
              korábbi <code>pii.read</code> AuditLog-bejegyzések megmaradtak —
              a hozzáférési előzmény követhető marad.
            </div>
          )}
        </section>
      )}

      {(submission.sourceUrls ?? []).length > 0 && (
        <section className="detail-section" style={{ padding: '0 0 28px', borderBottom: 0 }}>
          <h4>
            Megadott források <span className="aside">{(submission.sourceUrls ?? []).length} db</span>
          </h4>
          <ul style={{ paddingLeft: 20, lineHeight: 1.7, fontSize: 13 }}>
            {(submission.sourceUrls ?? []).map((u) => (
              <li key={u} style={{ wordBreak: 'break-all' }}>
                <a href={u} target="_blank" rel="noopener noreferrer">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {attachments.length > 0 && (
        <section className="detail-section" style={{ padding: '0 0 28px', borderBottom: 0 }}>
          <h4>
            Csatolmányok <span className="aside">{attachments.length} db</span>
          </h4>
          <table className="case-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Fájl</th>
                <th>Méret</th>
                <th>Vírus-szkenelés</th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((a) => (
                <tr key={a.id}>
                  <td data-label="Fájl">{a.fileName}</td>
                  <td data-label="Méret">{Math.round(a.sizeBytes / 1024)} KB</td>
                  <td data-label="Vírus-szkenelés">
                    <span
                      className={`state-badge ${
                        a.virusScanStatus === 'clean'
                          ? 'approved'
                          : a.virusScanStatus === 'pending'
                            ? 'pending'
                            : 'rejected'
                      }`}
                    >
                      <span className="dot" />
                      {a.virusScanStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>
            A <code>pending</code> státuszú csatolmányok letöltése csak a
            Cloudmersive jóváhagyás után engedélyezett.
          </p>
        </section>
      )}

      <section className="detail-section" style={{ padding: '0 0 60px', borderBottom: 0 }}>
        <h4>Akciók</h4>
        <SubmissionActions submissionId={submission.id} status={submission.status} />
      </section>
    </>
  );
}
