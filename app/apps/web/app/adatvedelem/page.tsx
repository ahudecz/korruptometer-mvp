import Link from 'next/link';
import { RevokeConsentButton } from './revoke-button';

export const metadata = {
  title: 'Adatvédelmi tájékoztató',
  description: 'A Kegyencjárat adatkezelési és cookie-tájékoztatója.',
};

export default function AdatvedelemPage() {
  return (
    <div className="news-section-wrap">
      <section className="section" id="adatvedelem">
        <div className="section-head">
          <div className="section-num">/ Adatvédelem</div>
          <h2 className="section-title">Adatvédelmi tájékoztató.</h2>
        </div>

        <div className="modszertan-body">

          <p className="modszertan-lead">
            A Kegyencjárat elkötelezett a látogatók magánszférájának védelme iránt.
            Ez a tájékoztató összefoglalja, milyen adatokat gyűjtünk, mire
            használjuk őket, és milyen jogok illetik meg.
          </p>

          <h3 className="modszertan-h3">Az adatkezelő</h3>

          <p>
            Marosi Balázs, magánszemély, kereskedelmi
            szervezet nélkül üzemelteti a Kegyencjárat weboldalt. Nincs
            kijelölt adatvédelmi tisztviselő (DPO) — a GDPR 37. cikke szerint
            erre jelen tevékenység terjedelme mellett nem vagyunk kötelezettek.
            Kapcsolat: <a href="mailto:hello@kegyencjarat.hu">hello@kegyencjarat.hu</a>
          </p>

          <h3 className="modszertan-h3">Milyen adatokat gyűjtünk?</h3>

          <p>
            A Kegyencjárat nem kér regisztrációt és nem tárol felhasználói fiókot.
            Két forrásból kerülhet hozzánk adat: a bejelentő űrlapon keresztül,
            illetve a Google Analytics révén (csak beleegyezés esetén).
          </p>

          <h3 className="modszertan-h3">Bejelentő űrlap</h3>

          <p>
            A <a href="/bejelentes">bejelentési oldalon</a> küldött tartalom
            az érintett személyre vonatkozó nyilvános információkat tartalmaz
            (név, pozíció, az ügy leírása, forráshivatkozások). Ezek nem a bejelentő
            személyes adatai — az adatbázisba kizárólag nyilvánosan ellenőrizhető
            tények kerülnek be.
          </p>

          <p>
            A bejelentő saját személyes adatát <strong>opcionálisan</strong> adhatja
            meg, és csak akkor, ha visszajelzést kér:
          </p>

          <div className="adom-costs">
            <div className="adom-cost-row">
              <span className="adom-cost-label">E-mail cím</span>
              <span className="adom-cost-val">opcionális — csak ha engedélyezi a kapcsolatfelvételt</span>
            </div>
            <div className="adom-cost-row">
              <span className="adom-cost-label">Név</span>
              <span className="adom-cost-val">opcionális — csak ha önként megadja</span>
            </div>
            <div className="adom-cost-row">
              <span className="adom-cost-label">IP-cím</span>
              <span className="adom-cost-val">nem rögzítjük</span>
            </div>
            <div className="adom-cost-row">
              <span className="adom-cost-label">Tárolás</span>
              <span className="adom-cost-val">végpont-titkosítva, a szerkesztőség ellenőrzéséig</span>
            </div>
          </div>

          <p>
            Anonim bejelentés esetén (alapértelmezett) semmilyen, a bejelentőre
            visszavezethető adat nem kerül rögzítésre. Az önként megadott
            e-mail-t és nevet kizárólag a szerkesztőségi visszajelzés céljára
            tároljuk, és harmadik félnek nem adjuk át.
          </p>

          <h3 className="modszertan-h3">Hírlevél-feliratkozás</h3>

          <p>
            A hírlevélre feliratkozáskor három adatot tárolunk: az e-mail címet
            titkosítva; a kiválasztott témákat; és a feliratkozás, illetve a
            megerősítés hálózati címének (IP) egy visszafejthetetlen
            azonosítóját, egy hash-t. Ez a hash a GDPR 4. cikk (5) bekezdése
            szerint álnevesített személyes adat, nem anonim adat, ezért ugyanúgy
            törlésre kerül, mint maga a cím. Nevet és semmilyen más szabad
            szöveges mezőt nem kérünk.
          </p>

          <p>
            <strong>Jogalap:</strong> az Ön hozzájárulása (GDPR 6. cikk (1)
            bekezdés a) pont). A hozzájárulást a címére küldött megerősítő
            levélben adja meg; addig egyetlen levelet sem küldünk azon kívül.
            Bizonyítékként a megerősítés időpontját, az akkori hálózati cím
            hash-ét és a megjelenített hozzájárulási szöveg verzióját tároljuk
            (GDPR 7. cikk (1) bekezdés).
          </p>

          <p>
            <strong>Megőrzés:</strong> leiratkozás után 30 nappal töröljük a
            titkosított e-mail címet, mindkét hálózati cím-hash-t és a
            megerősítő tokent. Megmarad az e-mail cím hash-e — ez a letiltási
            jelölő, ami megakadályozza, hogy a cím újra felkerüljön a listára —,
            az állapot és a hozzájárulási szöveg verziója.
          </p>

          <p>
            <strong>Törlés kérése:</strong> minden levélben van egy
            egykattintásos leiratkozó link. Azonnali törlést a{' '}
            <a href="mailto:hello@kegyencjarat.hu">hello@kegyencjarat.hu</a>{' '}
            címen kérhet — ilyenkor a fenti 30 napos várakozás elmarad, és a
            következő söprés azonnal töröl.
          </p>

          <p>
            <strong>Adatfeldolgozó:</strong> a leveleket a Resend
            (Plus Five Five, Inc.) küldi ki. A szolgáltató küldési naplói
            legfeljebb hét napig őrzik a címzetti címeket.
          </p>

          <h3 className="modszertan-h3">Google Analytics</h3>

          <p>
            Ha hozzájárul a cookie-k használatához, a Google Analytics az alábbi
            adatokat rögzíti:
          </p>

          <div className="adom-costs">
            <div className="adom-cost-row">
              <span className="adom-cost-label">Megtekintett oldalak</span>
              <span className="adom-cost-val">URL-ek, tartózkodási idő</span>
            </div>
            <div className="adom-cost-row">
              <span className="adom-cost-label">Technikai adatok</span>
              <span className="adom-cost-val">böngésző típusa, képernyőméret</span>
            </div>
            <div className="adom-cost-row">
              <span className="adom-cost-label">Földrajzi adat</span>
              <span className="adom-cost-val">ország/város szint (IP anonimizálva)</span>
            </div>
            <div className="adom-cost-row">
              <span className="adom-cost-label">Forgalomforrás</span>
              <span className="adom-cost-val">honnan érkezett (pl. Google, közösségi média)</span>
            </div>
          </div>

          <p>
            Az IP-cím anonimizálva kerül rögzítésre — az utolsó oktett törlésre
            kerül, így az adatból nem azonosítható be egyéni látogató. Az adatokat
            a Google LLC kezeli, amelynek adatvédelmi tájékoztatója
            elérhető a <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com</a> címen.
          </p>

          <p>
            Az adatokat kizárólag a látogatottsági statisztikák elemzésére
            használjuk — reklámcélú profilalkotásra, remarketing célokra vagy
            harmadik félnek történő értékesítésre nem.
          </p>

          <h3 className="modszertan-h3">Cookie-k</h3>

          <p>
            Ha elfogadja az analitikai cookie-kat, a Google Analytics egy egyedi
            azonosítót tárol a böngészőjében (általában 2 évig). Ha elutasítja,
            nem kerül semmilyen tracking cookie a gépére — az oldal teljes
            funkcionalitással használható cookie-k nélkül is.
          </p>

          <p>
            A beleegyezés visszavonható bármikor: törölje a böngésző
            cookie-jait, vagy kattintson{' '}
            <RevokeConsentButton />
            .
          </p>

          <h3 className="modszertan-h3">Az Ön jogai (GDPR)</h3>

          <p>
            Az Európai Unió Általános Adatvédelmi Rendeletének (GDPR) értelmében
            Önnek joga van:
          </p>

          <ul style={{ paddingLeft: '20px', lineHeight: '2' }}>
            <li>tájékoztatást kérni az Önről tárolt adatokról</li>
            <li>kérni az adatok törlését</li>
            <li>visszavonni a hozzájárulását bármikor</li>
            <li>panaszt tenni a Nemzeti Adatvédelmi és Információszabadság Hatóságnál (NAIH)</li>
          </ul>

          <p>
            Adatvédelmi kérdéssel forduljon hozzánk a{' '}
            <a href="mailto:hello@kegyencjarat.hu">hello@kegyencjarat.hu</a> címen.
          </p>

          <h3 className="modszertan-h3">Változtatások</h3>

          <p>
            Fenntartjuk a jogot a tájékoztató módosítására. Jelentős változás
            esetén az oldalon jelezzük. A tájékoztató utolsó frissítése:
            2026. június.
          </p>

          <div className="modszertan-back">
            <Link href="/">← Főoldal</Link>
          </div>

        </div>
      </section>
    </div>
  );
}
