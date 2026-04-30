'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Status = 'received' | 'in_review' | 'approved' | 'rejected' | 'duplicate';

const TRANSITIONS: { action: 'approve' | 'reject' | 'duplicate' | 'in_review'; label: string }[] = [
  { action: 'in_review', label: 'Vizsgálat alá vesz' },
  { action: 'approve', label: 'Jóváhagy + ügy létrehoz' },
  { action: 'reject', label: 'Elutasít' },
  { action: 'duplicate', label: 'Duplikátum' },
];

export function SubmissionActions({
  submissionId,
  status,
}: {
  submissionId: string;
  status: Status;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dispatch(action: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Hiba történt.');
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {TRANSITIONS.map((t) => (
        <button
          key={t.action}
          type="button"
          className={t.action === 'approve' ? 'btn btn-primary' : 'btn btn-ghost'}
          onClick={() => dispatch(t.action)}
          disabled={pending || (t.action === 'in_review' && status !== 'received')}
        >
          {t.label}
        </button>
      ))}
      <span style={{ alignSelf: 'center', color: 'var(--muted)', fontSize: 12 }}>
        {pending ? 'Műveletet végzek…' : `Aktuális állapot: ${status}`}
      </span>
      {error && (
        <p style={{ color: 'var(--accent)', fontSize: 13, width: '100%' }}>{error}</p>
      )}
    </div>
  );
}
