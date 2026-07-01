'use client';

export function RevokeConsentButton() {
  function revoke() {
    localStorage.removeItem('kj_cookie_consent');
    window.location.reload();
  }

  return (
    <button className="adatv-revoke-btn" onClick={revoke}>
      ide a hozzájárulás visszavonásához
    </button>
  );
}
