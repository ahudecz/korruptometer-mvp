import { CallbackHandler } from './callback-handler';

export default function AuthCallbackPage() {
  return (
    <section className="section" style={{ maxWidth: 480 }}>
      <h2>Bejelentkezés…</h2>
      <p className="lede">Pillanatnyi türelem, beállítjuk a munkamenetedet.</p>
      <CallbackHandler />
    </section>
  );
}
