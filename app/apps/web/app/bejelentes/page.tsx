import { SubmissionForm } from './submission-form';
import { TrustCopy } from './trust-copy';

export const dynamic = 'force-dynamic';

export default function BejelentesPage() {
  return (
    <section className="section">
      <div className="section-eyebrow">Bejelentés</div>
      <h2>Tájékoztass minket egy korrupciós ügyről.</h2>
      <p className="lede">
        A bejelentésedet a szerkesztőség olvassa át; ami megalapozott, az új
        ügyként kerül az adatbázisba. Csak akkor adj meg személyes elérhetőséget,
        ha visszahívást szeretnél — egyébként az űrlap teljesen anonim.
      </p>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: 18,
          marginBottom: 24,
        }}
      >
        <strong style={{ display: 'block', marginBottom: 8 }}>Mit őrzünk meg, mit nem:</strong>
        <TrustCopy />
      </div>
      <SubmissionForm />
    </section>
  );
}
