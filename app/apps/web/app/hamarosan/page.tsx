import Link from 'next/link';

const upcoming = [
  'Adatvédelmi tájékoztató',
  'Módszertani leírás',
  'Sajtószoba',
  'Partneri lista',
  'Csapat',
  'Nyilvános CSV / API export',
  'Támogatási csatornák',
];

export default function HamarosanPage() {
  return (
    <section className="hamarosan">
      <div className="section-eyebrow">Hamarosan</div>
      <h1>Hamarosan elérhető.</h1>
      <p className="lede">
        Ez az oldal egyelőre nincs készen. A láblécben szereplő hivatkozások itt
        landolnak addig, amíg a szerkesztőség mindegyiket önálló oldalként
        publikálja. A kontent a Phase 1 után érkezik, de adatvédelmi kérdéseidet
        már most tudjuk fogadni.
      </p>

      <ul>
        {upcoming.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>

      <p>
        Adatvédelmi vagy GDPR-jellegű kérés esetén írj a{' '}
        <a href="mailto:dpo@korruptometer.hu">dpo@korruptometer.hu</a> címre. A
        megkereséseket 30 napon belül megválaszoljuk.
      </p>

      <p style={{ marginTop: 24 }}>
        <Link href="/" className="btn btn-ghost">
          ← Vissza a főoldalra
        </Link>
      </p>
    </section>
  );
}
