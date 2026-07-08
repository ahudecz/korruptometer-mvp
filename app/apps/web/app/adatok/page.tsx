import Link from 'next/link';

export const metadata = {
  title: 'Adatok letöltése',
  description: 'Az adatbázis CSV formátumban letölthető, és API hozzáférés is tervezett.',
};

export default function AdatokPage() {
  return (
    <div className="news-section-wrap">
      <section className="section" id="adatok">
        <div className="section-head">
          <div className="section-num">/ Adatok</div>
          <h2 className="section-title">Töltsd le, használd fel.</h2>
        </div>

        <div className="modszertan-body">

          <p className="modszertan-lead">
            A Kegyencjárat adatai nyilvánosak és szabadon felhasználhatók kutatási,
            újságírói és oktatási célokra. Az automatizált hozzáférés fejlesztés alatt
            áll — az alábbiakban leírjuk, mi az aktuális állapot és mi várható.
          </p>

          <h3 className="modszertan-h3">CSV letöltés</h3>

          <div className="hamarosan-box">
            <div className="hamarosan-badge">Hamarosan</div>
            <p>
              Az adatbázis teljes tartalma CSV formátumban letölthető lesz — ügyenként
              egy sor, az összes strukturált mezővel. Tervezett tartalom:
            </p>
            <ul className="modszertan-list">
              <li>ügyazonosító, cím, kategória, érintett személy(ek)</li>
              <li>érintett közpénz összege és pénznem</li>
              <li>ügy státusza (aktív / lezárt / ismeretlen)</li>
              <li>forrás URL-ek</li>
              <li>utolsó módosítás dátuma</li>
            </ul>
            <p>
              A CSV-t <a href="mailto:hello@kegyencjarat.hu">emailben kérheted</a> addig
              is — egy munkanapon belül elküldjük.
            </p>
          </div>

          <h3 className="modszertan-h3">API hozzáférés</h3>

          <div className="hamarosan-box">
            <div className="hamarosan-badge">Fejlesztés alatt</div>
            <p>
              REST API végpontok tervezett specifikációja:
            </p>
            <ul className="modszertan-list">
              <li><code>GET /api/v1/cases</code> — összes ügy, szűrhető kategória/státusz szerint</li>
              <li><code>GET /api/v1/cases/:id</code> — egy ügy részletei</li>
              <li><code>GET /api/v1/persons</code> — galéria-szereplők listája</li>
              <li><code>GET /api/v1/stats</code> — KPI-aggregátumok</li>
            </ul>
            <p>
              Az API kulcs nélkül, rate-limittel lesz elérhető. Nagyobb forgalmú
              hozzáférés esetén regisztrációhoz kötjük. Ha az API-t aktívan várod,{' '}
              <a href="mailto:hello@kegyencjarat.hu">jelezd emailben</a> — a kereslet
              befolyásolja a fejlesztési prioritásokat.
            </p>
          </div>

          <h3 className="modszertan-h3">Felhasználási feltételek</h3>

          <p>
            Az adatok szabadon felhasználhatók, ha az alábbi feltételek teljesülnek:
          </p>
          <ul className="modszertan-list">
            <li>A forrást pontosan jelölöd meg: <em>Kegyencjárat (kegyencjarat.hu)</em></li>
            <li>
              Ha az adat K-Monitortól vagy más partnertől származik, az eredeti forrást
              is hivatkozod
            </li>
            <li>Az adatot nem módosítod, csak kivonatot készítesz belőle</li>
            <li>Kereskedelmi felhasználás esetén kérj előzetes hozzájárulást</li>
          </ul>

          <div className="modszertan-back">
            <Link href="/modszertan">← Módszertan</Link>
            {' · '}
            <Link href="/">Főoldal</Link>
          </div>

        </div>
      </section>
    </div>
  );
}
