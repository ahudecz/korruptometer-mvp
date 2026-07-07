import Link from 'next/link';

export const metadata = {
  title: 'Hamarosan',
  description: 'Ez a rész még fejlesztés alatt áll — hamarosan elérhető lesz a Kegyencjáraton.',
  robots: { index: false, follow: true },
};

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
      <div className="hero-eyebrow">Hamarosan</div>
      <h1>
        Még nincs<br />
        kész.
      </h1>
      <p>
        Ez az oldal egyelőre nincs készen. A láblécben szereplő hivatkozások itt
        landolnak addig, amíg a szerkesztőség mindegyiket önálló oldalként
        publikálja. Adatvédelmi kérdéseidet már most tudjuk fogadni.
      </p>

      <ul>
        {upcoming.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>

      <p>
        Adatvédelmi vagy GDPR-jellegű kérés esetén írj a{' '}
        <a
          href="mailto:hello@kegyencjarat.hu"
          style={{ color: 'var(--accent)', textDecoration: 'underline' }}
        >
          hello@kegyencjarat.hu
        </a>{' '}
        címre. A megkereséseket 30 napon belül megválaszoljuk.
      </p>

      <Link href="/" className="back">
        ← Vissza a főoldalra
      </Link>
    </section>
  );
}
