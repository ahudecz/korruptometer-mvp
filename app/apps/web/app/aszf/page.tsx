import Link from 'next/link';

export const metadata = {
  title: 'ÁSZF',
  description: 'A Kegyencjárat weboldal használatának általános szerződési feltételei.',
};

export default function AszfPage() {
  return (
    <div className="news-section-wrap">
      <section className="section" id="aszf">
        <div className="section-head">
          <div className="section-num">/ ÁSZF</div>
          <h2 className="section-title">Általános szerződési feltételek.</h2>
        </div>

        <div className="modszertan-body">

          <p className="modszertan-lead">
            Jelen dokumentum a kegyencjarat.hu weboldal (a továbbiakban:
            „Kegyencjárat") használatának feltételeit szabályozza. A weboldal
            böngészésével és/vagy a bejelentő űrlap használatával a látogató
            elfogadja az alábbi feltételeket.
          </p>

          <h3 className="modszertan-h3">A szolgáltatás jellege</h3>
          <p>
            A Kegyencjárat egy díjmentesen elérhető, nyilvános forrásokon
            (sajtócikkek, bírósági iratok, közbeszerzési adatbázisok) alapuló
            híraggregátor és adatbázis-szolgáltatás. A szolgáltatás
            üzemeltetőit lásd az <Link href="/impresszum">Impresszumban</Link>.
          </p>

          <h3 className="modszertan-h3">A tartalom forrása és pontossága</h3>
          <p>
            Az adatbázisban szereplő állítások nyilvánosan elérhető és
            ellenőrizhető forrásokon alapulnak — minden ügyhöz legalább egy
            forráshivatkozást közlünk. Törekszünk a pontosságra, de nem
            garantáljuk a közölt adatok hiánytalanságát vagy folyamatos
            frissítését. Hibát a <a href="mailto:hello@kegyencjarat.hu">hello@kegyencjarat.hu</a>{' '}
            címen jelezhetsz.
          </p>

          <h3 className="modszertan-h3">Az ártatlanság vélelme</h3>
          <p>
            A folyamatban lévő büntetőeljárások, letartóztatások és
            gyanúsítások ismertetése nem jelenti az érintett személy bűnösségét
            — mindaddig, amíg jogerős bírósági ítélet nem születik, az
            ártatlanság vélelme megilleti az érintettet.
          </p>

          <h3 className="modszertan-h3">Bejelentések (/bejelentes)</h3>
          <p>
            A bejelentő űrlapon beküldött tartalmat a szerkesztők nyilvános
            források alapján ellenőrzik, és csak megerősített információ
            kerül publikálásra. A bejelentő a küldéssel elfogadja, hogy a
            tartalmat a szerkesztőség nyilvánosan ellenőrizheti és — közforrások
            alapján — felhasználhatja. Zaklatás vagy alaptalan, rosszhiszemű
            vádaskodás céljából történő bejelentés esetén a bejelentő jogi
            felelősséggel tartozik. Az adatkezelés részleteit lásd az{' '}
            <Link href="/adatvedelem">Adatvédelmi tájékoztatóban</Link>.
          </p>

          <h3 className="modszertan-h3">Felelősségkorlátozás</h3>
          <p>
            A Kegyencjárat „ahogy van" alapon érhető el. Az üzemeltetők nem
            vállalnak felelősséget a weboldal folyamatos, hibamentes
            elérhetőségéért, sem a más weboldalakra mutató hivatkozások
            tartalmáért.
          </p>

          <h3 className="modszertan-h3">Adományozás</h3>
          <p>
            Az önkéntes adományozás egy külső szolgáltatón (Buy Me a Coffee)
            keresztül történik, annak saját felhasználási feltételei szerint.
            Az adomány a szolgáltatás fenntartását (szerver, adatbázis,
            eszközök) szolgálja, ellenszolgáltatás nem jár érte.
          </p>

          <h3 className="modszertan-h3">Szellemi tulajdon</h3>
          <p>
            A weboldal saját szerkesztői tartalma (összefoglalók, elemzések,
            vizualizációk) szabadon idézhető forrásmegjelöléssel. A harmadik
            féltől (K-Monitor, sajtóorgánumok) átvett tartalmakra azok saját
            licencfeltételei érvényesek.
          </p>

          <h3 className="modszertan-h3">Kapcsolódó dokumentumok</h3>
          <p>
            <Link href="/impresszum">Impresszum</Link> ·{' '}
            <Link href="/adatvedelem">Adatvédelmi tájékoztató</Link> ·{' '}
            <Link href="/modszertan">Módszertan</Link>
          </p>

          <div className="modszertan-back">
            <Link href="/">← Főoldal</Link>
          </div>

        </div>
      </section>
    </div>
  );
}
