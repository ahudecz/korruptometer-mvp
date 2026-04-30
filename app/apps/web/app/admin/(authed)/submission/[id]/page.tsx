import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { fmtDate, fmtFt } from '@korr/shared/format';
import { decryptPii } from '@korr/shared/encryption';

import { requireEditor } from '@/lib/admin/auth';
import { getDb, schema } from '@/lib/db';

import { SubmissionActions } from './submission-actions';

export const dynamic = 'force-dynamic';

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

  return (
    <>
      <p style={{ marginTop: 16, fontSize: 13 }}>
        <Link href="/admin">← Vissza a sorhoz</Link>
      </p>
      <h3 style={{ marginTop: 8 }}>{submission.ref}</h3>
      <p className="lede" style={{ marginBottom: 16 }}>
        Beérkezett: {fmtDate(submission.createdAt)} · Állapot:{' '}
        <strong>{submission.status}</strong>
      </p>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="label">Gyanúsított</div>
          <div className="value" style={{ fontSize: 22 }}>
            {submission.suspectName}
          </div>
        </div>
        {submission.suspectPosition && (
          <div className="kpi">
            <div className="label">Pozíció</div>
            <div className="value" style={{ fontSize: 18 }}>
              {submission.suspectPosition}
            </div>
          </div>
        )}
        {submission.suspectRegion && (
          <div className="kpi">
            <div className="label">Régió</div>
            <div className="value" style={{ fontSize: 18 }}>
              {submission.suspectRegion}
            </div>
          </div>
        )}
        {submission.estimatedAmount !== null && submission.estimatedAmount !== undefined && (
          <div className="kpi">
            <div className="label">Becsült érintett</div>
            <div className="value" style={{ fontSize: 22 }}>
              {fmtFt(submission.estimatedAmount)}
            </div>
          </div>
        )}
      </div>

      <h4 style={{ marginTop: 24, marginBottom: 8 }}>Cselekmények</h4>
      <div className="rogue-tags" style={{ padding: 0 }}>
        {(submission.crimes ?? []).map((c) => (
          <span className="tag" key={c}>
            {c}
          </span>
        ))}
      </div>

      <h4 style={{ marginTop: 24, marginBottom: 8 }}>Összefoglaló</h4>
      {sealedBoxOnly ? (
        <div className="empty-state" style={{ textAlign: 'left' }}>
          Sealed-box mód aktív — a tartalom titkosítva, csak a böngészőben
          olvasható egy szerkesztői privát kulccsal. (Phase 4 teljes UI a US15
          implementációja után érhető el.)
        </div>
      ) : (
        <p
          style={{
            background: 'var(--surface)',
            padding: 16,
            borderRadius: 12,
            whiteSpace: 'pre-wrap',
          }}
        >
          {submission.summary ?? '(üres)'}
        </p>
      )}

      {(reporterEmail || reporterName) && (
        <>
          <h4 style={{ marginTop: 24, marginBottom: 8 }}>
            Elérhetőség (titkosítva tárolva)
          </h4>
          <p style={{ fontSize: 14 }}>
            {reporterName && (
              <>
                <strong>Név:</strong> {reporterName}
                <br />
              </>
            )}
            {reporterEmail && (
              <>
                <strong>E-mail:</strong> {reporterEmail}
              </>
            )}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
            Ennek az olvasásnak a tényét a <code>pii.read</code> AuditLog-bejegyzés
            örökre megőrzi.
          </p>
        </>
      )}

      {(submission.sourceUrls ?? []).length > 0 && (
        <>
          <h4 style={{ marginTop: 24, marginBottom: 8 }}>Megadott források</h4>
          <ul style={{ paddingLeft: 24 }}>
            {(submission.sourceUrls ?? []).map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noopener noreferrer">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {attachments.length > 0 && (
        <>
          <h4 style={{ marginTop: 24, marginBottom: 8 }}>Csatolmányok ({attachments.length})</h4>
          <ul style={{ paddingLeft: 24 }}>
            {attachments.map((a) => (
              <li key={a.id} style={{ fontSize: 14 }}>
                {a.fileName} ({Math.round(a.sizeBytes / 1024)} KB) ·{' '}
                vírus-szkenelés: <strong>{a.virusScanStatus}</strong>
              </li>
            ))}
          </ul>
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>
            A <code>pending</code> státuszú csatolmányok letöltése csak a
            Cloudmersive jóváhagyás után engedélyezett.
          </p>
        </>
      )}

      <h4 style={{ marginTop: 24, marginBottom: 8 }}>Akciók</h4>
      <SubmissionActions submissionId={submission.id} status={submission.status} />
    </>
  );
}
