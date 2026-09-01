import { UnsubscribeForm } from './unsubscribe-form';

export const metadata = {
  title: 'Leiratkozás',
  robots: { index: false, follow: false },
};

/**
 * 012-reader-subscriptions FR-034, FR-035 — a leiratkozó oldal. Érvényes,
 * lejárt és kitalált token esetén azonos HTML; a megjelenítés semmit nem
 * módosít.
 *
 * MÉRT ÁLLÍTÁS (2026-09-01, helyi ellenőrzés): egy ÉRVÉNYES és egy KITALÁLT
 * tokennel lekért oldal HTML-je bájtra azonos, amint az olvasó SAJÁT
 * token-sztringjét kimaszkoljuk. Az egyetlen kérésenkénti eltérés az, hogy a
 * Next.js App Router a kérés URL-jét — benne a tokennel — visszaírja a
 * router-állapotba. Az a token az olvasó sajátja, és SEMMIT nem árul el az
 * érvényességéről: az csak a beküldés után derül ki (FR-035, SC-009).
 */
export default function LeiratkozasPage() {
  return (
    <div className="newsletter-page">
      <h1>Biztosan leiratkozol?</h1>
      <p>
        Ezután nem küldünk több levelet. Bármikor visszatérhetsz a{' '}
        <a href="/hirlevel">hírlevél oldalán</a>.
      </p>
      <UnsubscribeForm />
    </div>
  );
}
