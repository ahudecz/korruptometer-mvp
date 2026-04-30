import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  NotAllowlistedError,
  NotSignedInError,
  requireEditor,
} from '@/lib/admin/auth';

import { StaleBanner } from './stale-banner';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email = '';
  let role = '';
  try {
    const session = await requireEditor();
    email = session.email;
    role = session.editor.role;
  } catch (err) {
    if (err instanceof NotSignedInError) {
      redirect('/admin/login');
    }
    if (err instanceof NotAllowlistedError) {
      return (
        <section className="section" style={{ maxWidth: 600 }}>
          <h2>Hozzáférés megtagadva.</h2>
          <p className="lede">
            A bejelentkezett e-mail nincs a szerkesztői listán, vagy a fiók
            inaktív. Kérd a rendszergazdától, hogy adjon hozzá a listához.
          </p>
          <Link href="/admin/login" className="btn btn-ghost">
            Másik e-maillel próbálnám
          </Link>
        </section>
      );
    }
    throw err;
  }

  return (
    <div className="section" style={{ paddingTop: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="section-eyebrow">Admin</div>
          <h2 style={{ marginBottom: 4 }}>Szerkesztői felület</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Bejelentkezve: <strong>{email}</strong> · szerep:{' '}
            <span className="pill">{role}</span>
          </p>
        </div>
        <nav aria-label="Admin navigáció">
          <ul style={{ display: 'flex', gap: 12, listStyle: 'none' }}>
            <li>
              <Link href="/admin">Sor</Link>
            </li>
            <li>
              <Link href="/admin/scraper-runs">Scraperek</Link>
            </li>
            <li>
              <Link href="/admin/dsr">DSR</Link>
            </li>
            <li>
              <Link href="/admin/editors">Szerkesztők</Link>
            </li>
          </ul>
        </nav>
      </div>
      <StaleBanner />
      {children}
    </div>
  );
}
