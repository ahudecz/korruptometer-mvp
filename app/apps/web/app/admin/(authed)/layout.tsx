import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  NotAllowlistedError,
  NotSignedInError,
  requireEditor,
} from '@/lib/admin/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AdminTabs } from './admin-tabs';
import { SignOutButton } from './sign-out-button';
import { StaleBanner } from './stale-banner';

export const dynamic = 'force-dynamic';

async function signOut() {
  'use server';
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email = '';
  let displayName = '';
  let role = '';
  try {
    const session = await requireEditor();
    email = session.email;
    displayName = session.editor.displayName ?? email.split('@')[0] ?? email;
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
    <>
      <nav className="admin-nav" aria-label="Admin">
        <div className="admin-nav-inner">
          <Link href="/admin" className="admin-brand">
            Korruptométer
          </Link>
          <span className="admin-brand-sep" aria-hidden />
          <span className="admin-brand-context">Admin · Ügyirat-kezelő</span>
          <AdminTabs />
          <div className="admin-user">
            <span className="who">
              Bejelentkezve mint <strong>{displayName}</strong> · <code>{role}</code>
            </span>
            <SignOutButton signOut={signOut} />
          </div>
        </div>
      </nav>

      <div className="admin-page">
        <StaleBanner />
        {children}

        <footer className="admin-foot">
          <div className="shortcuts">
            <span className="sc">
              <kbd>↑</kbd>
              <kbd>↓</kbd> Léptetés
            </span>
            <span className="sc">
              <kbd>A</kbd> Jóváhagyás
            </span>
            <span className="sc">
              <kbd>R</kbd> Elutasít
            </span>
            <span className="sc">
              <kbd>D</kbd> Halaszt
            </span>
            <span className="sc">
              <kbd>/</kbd> Keresés
            </span>
          </div>
          <div>
            Forrás <strong>K-Monitor · kmdb_base</strong> · CC-BY-SA-4.0 ·{' '}
            <strong>{email}</strong>
          </div>
        </footer>
      </div>
    </>
  );
}
