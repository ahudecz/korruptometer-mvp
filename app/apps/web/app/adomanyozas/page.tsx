import Link from 'next/link';

export const metadata = {
  title: 'Adományozás – Kegyencjárat',
  description: 'Támogasd a Kegyencjárat független tényfeltáró munkáját.',
};

export default function AdomanyozasPage() {
  return (
    <div className="news-section-wrap">
      <section className="section" id="adomanyozas">
        <div className="section-head">
          <div className="section-num">/ Adományozás</div>
          <h2 className="section-title">Támogasd a munkát.</h2>
        </div>

        <div className="modszertan-body">

          <p className="modszertan-lead">
            A Kegyencjárat független — nincs mögötte médiacsoport, párt vagy szponzor.
            Az adatbázis fenntartása, fejlesztése és naprakészen tartása valódi idő- és
            pénzköltséget jelent. Ha hasznosnak találod, amit csinálunk, egy kis havi
            támogatás sokat segít.
          </p>

          <h3 className="modszertan-h3">Mire megy el a pénz?</h3>

          <div className="adom-costs">
            <div className="adom-cost-row">
              <span className="adom-cost-label">AI-eszközök (2 fő)</span>
              <span className="adom-cost-val">~59 400 Ft / hó</span>
            </div>
            <div className="adom-cost-row">
              <span className="adom-cost-label">Szerver és adatbázis</span>
              <span className="adom-cost-val">~16 500 Ft / hó</span>
            </div>
            <div className="adom-cost-row">
              <span className="adom-cost-label">Domain és egyéb</span>
              <span className="adom-cost-val">~1 700 Ft / hó</span>
            </div>
            <div className="adom-cost-row adom-cost-total">
              <span className="adom-cost-label">Önkéntes munka</span>
              <span className="adom-cost-val">80 óra / hó</span>
            </div>
          </div>

          <p>
            A technikai fenntartás havi ~77&nbsp;000 forintba kerül. Ez az önkéntes
            munkát nem tartalmazza — az a projekt iránti elkötelezettségből jön.
            Ha csak a számlák felét fedeznék az adományok, az már hatalmas segítség lenne.
          </p>

          <h3 className="modszertan-h3">Hogyan támogathatsz?</h3>

          <div className="adom-bmc-box">
            <div className="adom-bmc-logo">☕</div>
            <div className="adom-bmc-content">
              <div className="adom-bmc-title">Buy Me a Coffee</div>
              <p className="adom-bmc-desc">
                Egy egyszerű, megbízható platform egyszerű, egyszeri támogatásra — kártyával, PayPal-lal vagy Apple Pay-jel, regisztráció nélkül is. Minden összeg egyenesen hozzánk érkezik.
              </p>
              <a
                href="https://buymeacoffee.com/kegyencjarat"
                target="_blank"
                rel="noopener noreferrer"
                className="adom-bmc-btn"
              >
                ☕ Küldök egy kávét →
              </a>
            </div>
          </div>

          <h3 className="modszertan-h3">Miért érdemes?</h3>

          <p>
            Magyarországon a korrupció nyomon követése eddig a nagy szerkesztőségek
            kiváltságaként működött — csak ők engedhették meg maguknak az összetett
            adatvizualizációt, a forrásrendszerek kezelését és a folyamatos frissítést.
            A Kegyencjárat ezt demokratizálja: bárki megnézheti, ki mennyit lopott,
            mikor mondott le és mi lett az ügyek vége.
          </p>

          <p>
            Az adományok segítenek fenntartani a szervereket, javítani az adatminőséget,
            és folytatni azt a fejlesztői munkát, ami ezeket az oldalakat élővé teszi.
            Nincs cserébe semmi különleges előny — csak az a tudat, hogy hozzájárultál
            egy fontosnak tartott projekthez.
          </p>

          <div className="modszertan-back">
            <Link href="/">← Főoldal</Link>
          </div>

        </div>
      </section>
    </div>
  );
}
