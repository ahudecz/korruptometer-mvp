'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ApprovalState = 'pending' | 'approved' | 'rejected';

export function TagDecisionForm({
  id,
  slug,
  initialCaseId,
  current,
}: {
  id: string;
  slug: string;
  initialCaseId: string | null;
  current: ApprovalState;
}) {
  const router = useRouter();
  const [caseId, setCaseId] = useState(initialCaseId ?? '');
  const [pending, setPending] = useState<ApprovalState | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(next: ApprovalState) {
    setPending(next);
    setError(null);
    try {
      const res = await fetch('/api/admin/kmonitor-tags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id,
          approvalState: next,
          caseId: next === 'approved' ? caseId.trim() || null : null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Hiba.');
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        aria-label={`Ügy-azonosító — ${slug}`}
        placeholder="Ügy-ID (pl. KM-012)"
        value={caseId}
        onChange={(e) => setCaseId(e.target.value)}
        style={{ width: 140 }}
      />
      {current !== 'approved' && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending !== null}
          onClick={() => decide('approved')}
        >
          {pending === 'approved' ? '…' : 'Jóváhagy'}
        </button>
      )}
      {current !== 'rejected' && (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending !== null}
          onClick={() => decide('rejected')}
        >
          {pending === 'rejected' ? '…' : 'Elutasít'}
        </button>
      )}
      {current !== 'pending' && (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending !== null}
          onClick={() => decide('pending')}
        >
          {pending === 'pending' ? '…' : 'Vissza a sorba'}
        </button>
      )}
      {error && (
        <span style={{ color: 'var(--accent)', fontSize: 13 }}>{error}</span>
      )}
    </div>
  );
}
