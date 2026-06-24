'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function HiddenToggle({ id, hidden }: { id: string; hidden: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await fetch(`/api/admin/social-posts/${id}/hidden`, { method: 'POST' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      style={{
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 600,
        color: hidden ? '#fff' : '#555',
        background: hidden ? '#888' : 'none',
        border: `1px solid ${hidden ? '#888' : '#d0d0d0'}`,
        borderRadius: 4,
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.6 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? '…' : hidden ? '👁 Elrejtve' : 'Elrejtés'}
    </button>
  );
}
