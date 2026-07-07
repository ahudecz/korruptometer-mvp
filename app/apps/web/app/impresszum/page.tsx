import Link from 'next/link';

export const metadata = {
  title: 'Impresszum',
  description: 'A Kegyencjárat oldal szolgáltatói adatai.',
};

export default function ImpresszumPage() {
  return (
    <div className="news-section-wrap">
      <section className="section" id="impresszum">
        <div className="section-head">
          <div className="section-num">/ Impresszum</div>
          <h2 className="section-title">Szolgáltatói adatok.</h2>
        </div>

        <div className="modszertan-body">

          <h3 className="modszertan-h3">A tartalomszolgáltató</h3>
          <p>
            Hudecz Attila és Marosi Balázs, magánszemélyek (a továbbiakban: „Szolgáltató"),
            akik közösen üzemeltetik a kegyencjarat.hu weboldalt (a továbbiakban: „Kegyencjárat").
          </p>

          <h3 className="modszertan-h3">Elérhetőség</h3>
          <p>
            E-mail: <a href="mailto:hello@kegyencjarat.hu">hello@kegyencjarat.hu</a><br />
            Postai levelezési cím: a Szolgáltatók a személyes biztonsági kockázatokra
            hivatkozva jelenleg nem tesznek közzé postai levelezési címet. Minden
            megkeresést a fenti e-mail címen fogadunk.
          </p>

          <h3 className="modszertan-h3">Tárhelyszolgáltató</h3>
          <p>
            Vercel Inc. (alkalmazás-hosting) és Supabase Inc. (adatbázis) — mindkettő
            az Egyesült Államokban bejegyzett szolgáltató.
          </p>

          <h3 className="modszertan-h3">A tartalomért felelős szerkesztők</h3>
          <p>
            Hudecz Attila, Marosi Balázs.
          </p>

          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            A Kegyencjárat nem minősül sajtóterméknek a médiatörvény (2010. évi CLXXXV. tv.)
            értelmében, hírösszesítő és tényfeltáró adatbázis-szolgáltatásként működik.
            Bővebben a szerkesztési elvekről: <Link href="/csapat">Csapat</Link> és{' '}
            <Link href="/modszertan">Módszertan</Link>.
          </p>

          <div className="modszertan-back">
            <Link href="/">← Főoldal</Link>
          </div>

        </div>
      </section>
    </div>
  );
}
