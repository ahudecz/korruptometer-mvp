'use client';

import { useRouter } from 'next/navigation';
import { use, useState, type FormEvent } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type State =
  | { kind: 'idle' }
  | { kind: 'pending'; email?: string }
  | { kind: 'sent'; email: string }
  | { kind: 'verified' }
  | { kind: 'err'; message: string };

export function LoginForm({
  next,
}: {
  next: Promise<Record<string, string | undefined>>;
}) {
  const params = use(next);
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function requestCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: 'pending' });
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      setState({ kind: 'err', message: error.message });
    } else {
      setState({ kind: 'sent', email });
    }
  }

  async function verifyCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind !== 'sent') return;
    setState({ kind: 'pending', email: state.email });
    const fd = new FormData(e.currentTarget);
    const token = String(fd.get('code') ?? '').trim();
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({
      email: state.email,
      token,
      type: 'email',
    });
    if (error) {
      setState({ kind: 'err', message: error.message });
    } else {
      setState({ kind: 'verified' });
      router.push(params?.next ?? '/admin');
    }
  }

  if (state.kind === 'verified') {
    return <p>Bejelentkezve. Átirányítás…</p>;
  }

  if (state.kind === 'sent' || (state.kind === 'pending' && state.email)) {
    const email = state.email ?? '';
    return (
      <form onSubmit={verifyCode} className="db-toolbar" style={{ display: 'grid', gap: 12 }}>
        <p style={{ fontSize: 14 }}>
          Kódot küldtünk a(z) <strong>{email}</strong> címre. A 6-jegyű kódot
          a Mailpit-ben találod (helyi dev) vagy az e-mailedben.
        </p>
        <input
          type="text"
          name="code"
          inputMode="numeric"
          pattern="\d{6}"
          required
          placeholder="123456"
          aria-label="Egyszer használatos kód"
          autoFocus
        />
        <button type="submit" className="btn btn-primary" disabled={state.kind === 'pending'}>
          Bejelentkezés
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setState({ kind: 'idle' })}
        >
          Másik e-mail
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="db-toolbar" style={{ display: 'grid', gap: 12 }}>
      <input
        type="email"
        name="email"
        required
        placeholder="szerkeszto@example.com"
        aria-label="E-mail"
      />
      <button type="submit" className="btn btn-primary" disabled={state.kind === 'pending'}>
        {state.kind === 'pending' ? 'Küldés…' : 'Kérj egy 6-jegyű kódot'}
      </button>
      {state.kind === 'err' && (
        <p style={{ color: 'var(--accent)', fontSize: 13 }}>{state.message}</p>
      )}
    </form>
  );
}
