'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  table: 'resignation' | 'closure' | 'verdict';
  id: string;
}

export function ReviewButtons({ table, id }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<null | 'approve' | 'reject'>(null);

  async function act(action: 'approve' | 'reject') {
    setLoading(action);
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ table, id, action }),
      });
      if (!res.ok) throw new Error('failed');
      router.refresh();
    } catch {
      alert('A művelet nem sikerült.');
      setLoading(null);
    }
  }

  const base = {
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 4,
    cursor: loading ? 'wait' : 'pointer',
  } as const;

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        onClick={() => act('approve')}
        disabled={loading !== null}
        style={{ ...base, color: '#0a7d33', background: 'none', border: '1px solid #b6e2c4' }}
      >
        {loading === 'approve' ? '…' : 'Elfogad'}
      </button>
      <button
        type="button"
        onClick={() => act('reject')}
        disabled={loading !== null}
        style={{ ...base, color: '#e31937', background: 'none', border: '1px solid #f7c8d0' }}
      >
        {loading === 'reject' ? '…' : 'Eldob'}
      </button>
    </div>
  );
}
