'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  id: string;
  name: string;
}

export function MediaClosureDeleteButton({ id, name }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Törlöd: „${name}"? Ez visszavonhatatlan.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/media-closures/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Hiba a törlés során');
      router.refresh();
    } catch {
      alert('A törlés nem sikerült.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      style={{
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 600,
        color: '#e31937',
        background: 'none',
        border: '1px solid #f7c8d0',
        borderRadius: 4,
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? '…' : 'Törlés'}
    </button>
  );
}
