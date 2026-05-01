import { Suspense } from 'react';

import { CallbackHandler } from './callback-handler';

// Pre-existing useSearchParams() in the client handler requires a Suspense
// boundary on the parent server component or a `force-dynamic` page.
export const dynamic = 'force-dynamic';

export default function AuthCallbackPage() {
  return (
    <section className="section" style={{ maxWidth: 480 }}>
      <h2>Bejelentkezés…</h2>
      <p className="lede">Pillanatnyi türelem, beállítjuk a munkamenetedet.</p>
      <Suspense fallback={<p style={{ color: 'var(--muted)' }}>Folyamatban…</p>}>
        <CallbackHandler />
      </Suspense>
    </section>
  );
}
