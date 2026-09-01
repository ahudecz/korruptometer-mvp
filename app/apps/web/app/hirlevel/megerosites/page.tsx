import { ConfirmForm } from './confirm-form';

export const metadata = {
  title: 'Feliratkozás megerősítése',
  robots: { index: false, follow: false },
};

/**
 * 012-reader-subscriptions FR-034, FR-035 — a megerősítő oldal.
 *
 * A kirajzolás SEMMIT nem módosít, és SEMMIT nem tud a tokenről: érvényes,
 * lejárt és kitalált token esetén ugyanazt a HTML-t adja vissza. Az
 * érvényesség csak a beküldés után derül ki.
 *
 * MÉRT ÁLLÍTÁS (2026-09-01, helyi ellenőrzés): egy ÉRVÉNYES és egy KITALÁLT
 * tokennel lekért oldal HTML-je bájtra azonos, amint az olvasó SAJÁT
 * token-sztringjét kimaszkoljuk. Az egyetlen kérésenkénti eltérés az, hogy a
 * Next.js App Router a kérés URL-jét — benne a tokennel — visszaírja a
 * router-állapotba. Az a token az olvasó sajátja, és SEMMIT nem árul el az
 * érvényességéről: az csak a beküldés után derül ki (FR-035, SC-009).
 */
export default function MegerositesPage() {
  return (
    <div className="newsletter-page">
      <h1>Erősítsd meg a feliratkozásod.</h1>
      <p>
        Egy kattintás, és kezdjük. Amíg ezt meg nem nyomod, semmilyen levelet nem
        küldünk erre a címre.
      </p>
      <ConfirmForm />
    </div>
  );
}
