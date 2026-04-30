'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function DsrIntakeForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    await fetch('/api/admin/dsr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subjectEmail: fd.get('subjectEmail'),
        kind: fd.get('kind'),
        notes: fd.get('notes') || null,
      }),
    });
    setPending(false);
    e.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="db-toolbar" style={{ marginTop: 8 }}>
      <input type="email" name="subjectEmail" required placeholder="adatalany@example.com" />
      <select name="kind" defaultValue="access">
        <option value="access">hozzáférés</option>
        <option value="deletion">törlés</option>
      </select>
      <input name="notes" placeholder="Megjegyzés (opcionális)" />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        DSR rögzítése
      </button>
    </form>
  );
}
