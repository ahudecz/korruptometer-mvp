import { LoginForm } from './login-form';

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <section className="section" style={{ maxWidth: 520 }}>
      <div className="section-eyebrow">Admin</div>
      <h2>Bejelentkezés</h2>
      <p className="lede">
        A szerkesztőség e-mail-alapú varázs-linkkel jelentkezik be. Csak a
        listán szereplő, aktív címek férnek hozzá. Minden más megkeresés
        elutasításra kerül.
      </p>
      <LoginForm next={searchParams} />
      <p style={{ marginTop: 16, color: 'var(--muted)', fontSize: 12 }}>
        Helyi fejlesztés esetén a varázs-link a Mailpit-en érkezik:{' '}
        <a href="http://127.0.0.1:54424" target="_blank" rel="noopener noreferrer">
          http://127.0.0.1:54424
        </a>
      </p>
    </section>
  );
}
