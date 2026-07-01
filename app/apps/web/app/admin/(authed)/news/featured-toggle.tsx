'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function FeaturedToggle({ id, featured }: { id: string; featured: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await fetch(`/api/admin/news/${id}/featured`, { method: 'POST' });
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
        color: featured ? '#fff' : '#555',
        background: featured ? '#e31937' : 'none',
        border: `1px solid ${featured ? '#e31937' : '#d0d0d0'}`,
        borderRadius: 4,
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.6 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? '…' : featured ? '★ Kiemelt' : 'Kiemel'}
    </button>
  );
}
