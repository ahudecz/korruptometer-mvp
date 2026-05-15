'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ApprovalState = 'pending' | 'approved' | 'rejected';

function fmtDecidedAt(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function PersonDecisionForm({
  id,
  displayName,
  initialCaseId,
  current,
  decidedAt,
  decidedBy,
}: {
  id: string;
  displayName: string;
  initialCaseId: string | null;
  current: ApprovalState;
  decidedAt: string | null;
  decidedBy?: string | null;
}) {
  const router = useRouter();
  const [caseId, setCaseId] = useState(initialCaseId ?? '');
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [pending, setPending] = useState<ApprovalState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset local state when switching to a different person.
  useEffect(() => {
    setCaseId(initialCaseId ?? '');
    setForceOverwrite(false);
    setError(null);
  }, [id, initialCaseId]);

  async function decide(next: ApprovalState) {
    setPending(next);
    setError(null);
    try {
      const res = await fetch('/api/admin/kmonitor-persons', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id,
          approvalState: next,
          caseId: next === 'approved' ? caseId.trim() || null : null,
          forceAmountOverwrite: next === 'approved' ? forceOverwrite : false,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Hiba.');
        return;
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="decision">
      <h4>Döntés</h4>
      <div className="caseid">
        <label htmlFor={`kmp-caseid-${id}`}>Ügyirat (case-id)</label>
        <input
          id={`kmp-caseid-${id}`}
          aria-label={`Ügy-azonosító — ${displayName}`}
          type="text"
          placeholder="KM-2026-… (kapcsoláshoz jóváhagyásnál)"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
        />
      </div>
      <div className="decision-buttons">
        <button
          type="button"
          className="dbtn primary"
          disabled={pending !== null || current === 'approved'}
          data-decision="approved"
          onClick={() => decide('approved')}
        >
          {pending === 'approved' ? '…' : 'Jóváhagyás'} <span className="key">A</span>
        </button>
        <button
          type="button"
          className="dbtn secondary"
          disabled={pending !== null || current === 'rejected'}
          data-decision="rejected"
          onClick={() => decide('rejected')}
        >
          {pending === 'rejected' ? '…' : 'Elutasít'} <span className="key">R</span>
        </button>
        <button
          type="button"
          className="dbtn ghost"
          disabled={pending !== null || current === 'pending'}
          data-decision="pending"
          onClick={() => decide('pending')}
        >
          {pending === 'pending' ? '…' : 'Halaszt'} <span className="key">D</span>
        </button>
      </div>
      <div className="decision-foot">
        <label title="Ha be van pipálva, a kapcsolt ügy összegét felülírjuk a medián értékkel akkor is, ha az ügy összege már nem nulla.">
          <input
            type="checkbox"
            checked={forceOverwrite}
            onChange={(e) => setForceOverwrite(e.target.checked)}
          />
          Felülír
        </label>
        <span>
          Utolsó döntés:{' '}
          <strong>{decidedAt ? fmtDecidedAt(decidedAt) : '—'}</strong>
          {decidedBy && (
            <>
              {' · '}Szerkesztő: <strong>{decidedBy}</strong>
            </>
          )}
        </span>
      </div>
      {error && <div className="decision-error">Hiba: {error}</div>}
    </div>
  );
}
