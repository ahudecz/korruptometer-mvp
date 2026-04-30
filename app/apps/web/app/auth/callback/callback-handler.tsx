'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Client-side magic-link callback. PKCE requires the original code_verifier
 * (stored in browser storage when signInWithOtp was called), so this exchange
 * MUST happen in the browser — not in a server route handler.
 */
export function CallbackHandler() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = search.get('code');
    const next = search.get('next') ?? '/admin';
    if (!code) {
      setError('Hiányzó verify kód.');
      return;
    }
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }
      router.replace(next);
    })();
  }, [search, router]);

  if (error) {
    return (
      <p style={{ color: 'var(--accent)' }}>
        Bejelentkezési hiba: {error}
      </p>
    );
  }
  return <p style={{ color: 'var(--muted)' }}>Folyamatban…</p>;
}
