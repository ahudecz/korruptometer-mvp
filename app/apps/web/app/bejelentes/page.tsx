import { MockupSubmissionForm } from '../_home/submission-form';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ name?: string; crimes?: string }>;
}

export default async function BejelentesPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialName = params.name ?? '';
  const initialCrimes = params.crimes ? params.crimes.split(',') : [];

  return (
    <section className="submission" id="submission" style={{ borderTop: 0 }}>
      <div className="submission-inner">
        <div className="submission-left">
          <div className="section-num">07 / Bejelentés</div>
          <h2>
            Hiányzik egy <em>név</em>?<br />
            Tedd be a galériába.
          </h2>
          <p>
            Ha tudsz olyan ügyről, ami még nem szerepel az adatbázisban, küldd
            el. Minden bejelentést egy független szerkesztő ellenőriz közforrások
            alapján — közbeszerzési adatbázisok, bírósági iratok, sajtótermékek.
          </p>
          <p>
            Csak <b>nyilvános források</b> alapján publikálunk. Ha bizonyíték
            nélküli pletykát küldesz, az nem jelenik meg a galériában.
          </p>
          <div className="submission-assurance">
            <strong>Forrásvédelem</strong>
            Beérkezésed végpont-titkosítva tároljuk. Az IP-címedet nem rögzítjük.
            Anonim bejelentés esetén nincs olyan adat, amely rád mutatna. Súlyosan
            bizalmas anyagokhoz használj{' '}
            <a
              href="/hamarosan"
              style={{ color: 'var(--accent)', textDecoration: 'underline' }}
            >
              SecureDrop
            </a>{' '}
            csatornát.
          </div>
        </div>

        <MockupSubmissionForm initialName={initialName} initialCrimes={initialCrimes} />
      </div>
    </section>
  );
}
