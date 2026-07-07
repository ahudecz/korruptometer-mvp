import { LoginForm } from './login-form';

export const metadata = {
  title: 'Admin bejelentkezés',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card">
        <div className="admin-login-eyebrow">Szerkesztői hozzáférés</div>
        <h1 className="admin-login-title">Bejelentkezés</h1>
        <p className="admin-login-desc">
          Csak az engedélyezett e-mail-címek férnek hozzá. Az egyszer
          használatos kódot e-mailben küldjük el.
        </p>
        <LoginForm next={searchParams} />
      </div>
    </div>
  );
}
