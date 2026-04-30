'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function EditorsForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      email: String(fd.get('email') ?? '').trim(),
      displayName: String(fd.get('displayName') ?? '').trim() || null,
      role: String(fd.get('role') ?? 'editor'),
    };
    try {
      const res = await fetch('/api/admin/editors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setError(j.error ?? 'Hiba.');
        return;
      }
      e.currentTarget.reset();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="db-toolbar" style={{ marginBottom: 8 }}>
      <input type="email" name="email" required placeholder="szerkeszto@example.com" />
      <input name="displayName" placeholder="Név (opcionális)" />
      <select name="role" defaultValue="editor">
        <option value="editor">editor</option>
        <option value="admin">admin</option>
      </select>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        Hozzáad
      </button>
      {error && <span style={{ color: 'var(--accent)', fontSize: 13 }}>{error}</span>}
    </form>
  );
}
