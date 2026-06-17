import Link from 'next/link';

export const metadata = {
  title: 'Sajtó – Kegyencjárat',
  description: 'Sajtókapcsolat, médiamegjelenések és sajtóanyagok a Kegyencjárathoz.',
};

export default function SajtoPage() {
  return (
    <div className="news-section-wrap">
      <section className="section" id="sajto">
        <div className="section-head">
          <div className="section-num">/ Sajtó</div>
          <h2 className="section-title">Sajtókapcsolat.</h2>
        </div>

        <div className="modszertan-body">

          <p className="modszertan-lead">
            Ha a Kegyencjáraton közölt adatokat fel szeretnéd használni cikkhez,
            riporthoz vagy kutatáshoz, vagy kérdésed van az adatbázis módszertanával
            kapcsolatban, az alábbi elérhetőségen vegyél fel velünk kapcsolatot.
          </p>

          <h3 className="modszertan-h3">Kapcsolatfelvétel</h3>

          <div className="adom-costs">
            <div className="adom-cost-row">
              <span className="adom-cost-label">Sajtómegkeresések</span>
              <span className="adom-cost-val">
                <a href="mailto:hello@kegyencjarat.hu">hello@kegyencjarat.hu</a>
              </span>
            </div>
            <div className="adom-cost-row">
              <span className="adom-cost-label">Válaszidő</span>
              <span className="adom-cost-val">általában 1–3 munkanap</span>
            </div>
          </div>

          <h3 className="modszertan-h3">Mire lehet számítani?</h3>

          <p>
            Adatainkat szívesen bocsátjuk rendelkezésre újságírói célokra. Egyedüli
            feltételünk, hogy a forrást pontosan jelöld meg: <em>Kegyencjárat adatai
            alapján</em> — és ha az eredeti adat K-Monitortól, Átlátszótól vagy más
            partnertől származik, azt az eredeti forrást is hivatkozd.
          </p>

          <p>
            Véleményt, kommentárt, szerkesztői álláspontot nem adunk sajtónak.
            Az adatokért, módszertanért és a megjelenített összefüggések pontosságáért
            helytállunk — de nem nyilatkozunk politikai kérdésekben, és nem vállalunk
            {'„szakértői"'} szerepet.
          </p>

          <h3 className="modszertan-h3">Sajtóanyagok</h3>

          <p>
            Jelenleg nem áll rendelkezésre letölthető sajtócsomag. Ha logóra, adatvizualizációkra
            vagy konkrét számokra van szükséged, írj emailt — az igénynek megfelelő
            anyagot összeállítjuk.
          </p>

          <h3 className="modszertan-h3">Újabb médiamegjelenések</h3>

          <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
            Az oldal 2026 tavaszán indult — az első médiamegjelenések dokumentálása
            folyamatban van.
          </p>

          <div className="modszertan-back">
            <Link href="/">← Főoldal</Link>
          </div>

        </div>
      </section>
    </div>
  );
}
