import Link from 'next/link';

export const metadata = {
  title: 'Partnerek – Kegyencjárat',
  description: 'A Kegyencjárat partneri szervezetei és együttműködései.',
};

export default function PartnerekPage() {
  return (
    <div className="news-section-wrap">
      <section className="section" id="partnerek">
        <div className="section-head">
          <div className="section-num">/ Partnerek</div>
          <h2 className="section-title">Akikre támaszkodunk.</h2>
        </div>

        <div className="modszertan-body">

          <p className="modszertan-lead">
            A Kegyencjárat nem önállóan gyűjti az összes adatot — a legjobb magyarországi
            tényfeltáró szervezetek munkájára támaszkodunk. Az adatbázisunkban lévő ügyek
            nagy része ezek forrásain alapul.
          </p>

          <h3 className="modszertan-h3">Elsődleges adatpartner</h3>

          <div className="partner-entry">
            <div className="partner-head">
              <a href="https://k-monitor.hu" target="_blank" rel="noopener noreferrer" className="partner-name">
                K-Monitor Közhasznú Egyesület
              </a>
              <span className="forras-entry-label">Elsődleges adatforrás</span>
            </div>
            <p className="partner-desc">
              A K-Monitor 2008 óta az ország legteljesebb korrupciós esetadatbázisát
              működteti. Módszertanuk átlátható, forrásaik ellenőrizhetők, és az egyetlen
              szervezet Magyarországon, amely ekkora mélységben dokumentálja a visszaéléseket
              strukturált adatbázisban. Az adatbázisunkban lévő ügyek és becsült kárösszegek
              döntő többsége az ő nyilvánosan elérhető adataikon alapul.
            </p>
          </div>

          <h3 className="modszertan-h3">Forráspartnerek</h3>

          <p>
            Az alábbi szerkesztőségek anyagait rendszeresen felhasználjuk — nem együttműködési
            megállapodás, hanem szerkesztési elvek alapján. Minden felhasznált anyagnál az
            eredeti forrást hivatkozzuk.
          </p>

          <div className="partner-entry">
            <div className="partner-head">
              <a href="https://direkt36.hu" target="_blank" rel="noopener noreferrer" className="partner-name">
                Direkt36
              </a>
              <span className="forras-entry-label">Nyomozói anyagok</span>
            </div>
            <p className="partner-desc">
              Magyarország vezető nyomozóriport-szerkesztősége. A Rogán-hálózathoz,
              a letelepedési kötvénybotrányhoz és az offshore struktúrákhoz kapcsolódó
              mélyanyagaikat primer forrásként kezeljük.
            </p>
          </div>

          <div className="partner-entry">
            <div className="partner-head">
              <a href="https://atlatszo.hu" target="_blank" rel="noopener noreferrer" className="partner-name">
                Átlátszó
              </a>
              <span className="forras-entry-label">Közpénz és adatok</span>
            </div>
            <p className="partner-desc">
              Közadatok és közpénz-átláthatóság specializált portálja. Az Elios-ügytől
              az ingatlanvagyonosodáson át az állami vagyon magánosításáig — az Átlátszó
              töri fel az adatokat, amiket mi strukturált formában közlünk.
            </p>
          </div>

          <div className="partner-entry">
            <div className="partner-head">
              <a href="https://transparency.hu" target="_blank" rel="noopener noreferrer" className="partner-name">
                Transparency International Magyarország
              </a>
              <span className="forras-entry-label">Civil partner</span>
            </div>
            <p className="partner-desc">
              A TI Magyarország éves korrupció-érzékelési adatait, büntetőfeljelentéseit
              és rendszerszintű elemzéseit hivatkozzuk az összefüggések dokumentálásánál.
            </p>
          </div>

          <h3 className="modszertan-h3">Együttműködési lehetőség</h3>

          <p>
            Ha szervezeted adatokat gyűjt magyarországi korrupcióval, közpénzekkel
            vagy elszámoltathatósággal kapcsolatban, és az együttműködés valamilyen
            formájában gondolkozol, írj a{' '}
            <a href="mailto:hello@kegyencjarat.hu">hello@kegyencjarat.hu</a> címre.
            Nem vállalunk minden felkérést, de minden megkeresésre válaszolunk.
          </p>

          <div className="modszertan-back">
            <Link href="/">← Főoldal</Link>
          </div>

        </div>
      </section>
    </div>
  );
}
