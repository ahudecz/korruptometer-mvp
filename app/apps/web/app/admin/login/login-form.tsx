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
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
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
    return <p className="admin-login-status">Bejelentkezve. Átirányítás…</p>;
  }

  if (state.kind === 'sent' || (state.kind === 'pending' && state.email)) {
    const email = state.email ?? '';
    return (
      <form onSubmit={verifyCode} className="admin-login-form">
        <p className="admin-login-sent-note">
          Kódot küldtünk a <strong>{email}</strong> címre.
        </p>
        <div className="admin-login-field">
          <label className="admin-login-label" htmlFor="code">
            6-jegyű kód
          </label>
          <input
            id="code"
            type="text"
            name="code"
            inputMode="numeric"
            pattern="\d{6}"
            required
            placeholder="123456"
            aria-label="Egyszer használatos kód"
            autoFocus
            className="admin-login-input admin-login-input--otp"
          />
        </div>
        {state.kind === 'err' && (
          <p className="admin-login-error">{state.message}</p>
        )}
        <button
          type="submit"
          className="admin-login-btn"
          disabled={state.kind === 'pending'}
        >
          {state.kind === 'pending' ? 'Ellenőrzés…' : 'Bejelentkezés →'}
        </button>
        <button
          type="button"
          className="admin-login-btn-ghost"
          onClick={() => setState({ kind: 'idle' })}
        >
          Másik e-mail-cím
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="admin-login-form">
      <div className="admin-login-field">
        <label className="admin-login-label" htmlFor="email">
          E-mail-cím
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          placeholder="szerkeszto@example.com"
          aria-label="E-mail"
          autoFocus
          className="admin-login-input"
        />
      </div>
      {state.kind === 'err' && (
        <p className="admin-login-error">{state.message}</p>
      )}
      <button
        type="submit"
        className="admin-login-btn"
        disabled={state.kind === 'pending'}
      >
        {state.kind === 'pending' ? 'Küldés…' : 'Kód kérése →'}
      </button>
    </form>
  );
}
