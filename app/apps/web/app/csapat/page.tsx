import Link from 'next/link';

export const metadata = {
  title: 'Csapat – Kegyencjárat',
  description: 'A Kegyencjárat mögötti emberek és szerkesztési elvek.',
};

export default function CsapatPage() {
  return (
    <div className="news-section-wrap">
      <section className="section" id="csapat">
        <div className="section-head">
          <div className="section-num">/ Csapat</div>
          <h2 className="section-title">Kik vagyunk.</h2>
        </div>

        <div className="modszertan-body">

          <p className="modszertan-lead">
            A Kegyencjárat nem egy szerkesztőség — két átlagember hozta létre,
            akik egy ponton elvesztették a fonalat. Annyira felgyorsult az
            eseménysor, hogy a mindennapi életben lehetetlenné vált követni:
            ki mondott le, kit rúgtak ki, melyik médium szűnt meg. Aztán a
            Vastagbőrön olvastuk, amit magunk is éreztünk — ők is azt írták,
            hogy ez már követhetetlen, egy lista kellene. Igaz. Úgyhogy megcsináltuk.
          </p>

          <h3 className="modszertan-h3">Hogyan működik?</h3>

          <p>
            A Kegyencjárat elsősorban híraggregátor: a független és factcheckelt
            online média cikkeit folyamatosan figyeljük, és ha bármi releváns változás
            történik, az adatbázis azonnal frissül. Kirúgták az Origó szerkesztőségének
            háromnegyedét? Lemondott Polt Péter? A lista frissül — nem másnap, hanem
            akkor, amikor a hír megjelenik.
          </p>

          <p>
            Az adatok elemzése közben sok olyan tartalomra bukkantunk, ami a napi
            hírfolyamban könnyen elvész. Ilyen volt például a{' '}
            <Link href="/lemondasok/rigo-csaba-balazs">
              Partizán-interjú a Gazdasági Versenyhivatal egykori belső munkatársával
            </Link>
            , aki nyilvánosan számolt be arról, hogyan védi a GVH a NER-közeli
            vállalkozókat. Ezért döntöttük el, hogy a híraggregáció mellé összegyűjtjük
            a kiemelt érdeklődésre számot tartó politikusok és ügyek aktáit is —
            a legfontosabb forrásokat, dokumentumokat, és azt, hogy a nyolc
            lemondásra felszólított közjogi méltóságnak pontosan miért kell mennie.
          </p>

          <p>
            A Kegyencjárat egyfajta Tisza-figyelő is. Folyamatosan nyomon követjük,
            mennyi közpénzt sikerül visszaszerezni a feltárt korrupciós ügyekben —
            az oldal indulása előtt már 2 milliárd forint felett járt a mutató
            csupán az NKA-ügy kapcsán, ami nem kis részben a Noir érdemének tekinthető.
            Emellett számon tartjuk a büntetőjogi felelősségre vonásokat is: ki ellen
            indult eljárás, ki kapott ítéletet, és mi lett az ügy vége. Ezekről
            az adatokról folyamatosan frissülő képet közlünk az oldalon.
          </p>

          <h3 className="modszertan-h3">Miért névtelen?</h3>

          <p>
            Két átlagembernek, akik Magyarországon hatalmukkal visszaélő politikusokról
            gyűjtenek adatokat, kockázatot jelent a nyilvános szerepvállalás. Ez nem
            paranoia — láttuk, mi történt más tényfeltáró kezdeményezésekkel.
            A projekt neve addig marad fenn, amíg az adatok pontosak és az oldalra
            nem kerül rá jogtalan nyomás.
          </p>

          <p>
            Ha a projekt nő, és a jogi és személyes kockázat kezelhetővé válik,
            szívesen tesszük transzparenssé, ki áll mögötte.
          </p>

          <h3 className="modszertan-h3">Mi van mögötte?</h3>

          <div className="adom-costs">
            <div className="adom-cost-row">
              <span className="adom-cost-label">Tartalom, adatgyűjtés, döntések</span>
              <span className="adom-cost-val">2 átlagember</span>
            </div>
            <div className="adom-cost-row">
              <span className="adom-cost-label">Technikai megvalósítás</span>
              <span className="adom-cost-val">AI-asszisztens (Claude)</span>
            </div>
            <div className="adom-cost-row">
              <span className="adom-cost-label">Partneri adatbázis</span>
              <span className="adom-cost-val">K-Monitor</span>
            </div>
            <div className="adom-cost-row">
              <span className="adom-cost-label">Infrastruktúra</span>
              <span className="adom-cost-val">Vercel + Supabase</span>
            </div>
          </div>

          <h3 className="modszertan-h3">Szerkesztési elvek</h3>

          <p>
            Minden ügy megjelenítéséhez legalább egy forrás szükséges, ami nyilvánosan
            elérhető és ellenőrizhető. Semmit nem teszünk fel anonimitásra hivatkozó
            kiszivárogtatások alapján, ha nem erősíti meg azt legalább egy strukturált
            forrás (bírósági irat, határozat, közbeszerzési adat).
          </p>

          <p>
            Az ismertetett adatoknál törekszünk arra, hogy a kárösszegek, ítéletek és
            állásváltozások a leggondosabban ellenőrzöttek legyenek — ez az a három
            terület, ahol a tévedés a legtöbb kárt okozza.
          </p>

          <h3 className="modszertan-h3">Támogatnál minket?</h3>

          <p>
            Az oldal mögött nincs médiacég, nincs szponzor — saját zsebből finanszírozzuk
            az egészet, a szervertől az AI-eszközökig. Minden forint számít, és egyenesen
            a projekt fenntartásába kerül.{' '}
            <Link href="/adomanyozas">Ha teheted, itt tudod támogatni a munkánkat →</Link>
          </p>

          <h3 className="modszertan-h3">Csatlakozni szeretnél?</h3>

          <p>
            Ha az ellenőrzésben, adatgyűjtésben vagy jogi háttérrel szeretnél segíteni,
            írj a <a href="mailto:hello@kegyencjarat.hu">hello@kegyencjarat.hu</a> címre.
            Nem fizetünk, de a munkádat jóváírjuk, ha nyilvánossá válik az oldal mögötti
            csapat.
          </p>

          <div className="modszertan-back">
            <Link href="/">← Főoldal</Link>
          </div>

        </div>
      </section>
    </div>
  );
}
