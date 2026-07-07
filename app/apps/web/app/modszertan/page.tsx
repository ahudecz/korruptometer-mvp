import Link from 'next/link';

export const metadata = {
  title: 'Módszertan',
  description: 'Hogyan gyűjtjük, ellenőrizzük és jelenítjük meg az adatokat a Kegyencjáraton.',
};

export default function ModszertanPage() {
  return (
    <div className="news-section-wrap">
      <section className="section" id="modszertan">
        <div className="section-head">
          <div className="section-num">/ Módszertan</div>
          <h2 className="section-title">Hogyan dolgozunk.</h2>
        </div>

        <div className="modszertan-body">

          <p className="modszertan-lead">
            A Kegyencjárat nyilvánosan hozzáférhető forrásokra támaszkodó, szerkesztett adatbázis.
            Célunk nem az, hogy ítéletet hozzunk — hanem az, hogy rendszerezett és kereshető formában
            tegyük elérhetővé azt, ami a közérdekű forrásokban már nyilvánosan dokumentált.
          </p>

          <h3 className="modszertan-h3">Adatforrások</h3>
          <p>Az adatbázis három forrástípusra épül.</p>

          <p>
            <strong>Partneri adatbázis.</strong> Elsődleges strukturált forrásunk a{' '}
            <a href="https://k-monitor.hu" target="_blank" rel="noopener noreferrer">K-Monitor Közhasznú Egyesület</a>{' '}
            adatbázisa, amely több mint 64&nbsp;000 dokumentált korrupciós esetet tartalmaz Magyarországról.
            A K-Monitor az egyik leghosszabb működési múlttal rendelkező, független civil kontroll szervezet
            az országban; adatbázisa bírósági iratokra, közbeszerzési nyilvántartásokra, vagyonnyilatkozatokra
            és hiteles sajtójelentésekre támaszkodik. Az általuk gyűjtött eseteket feldolgoztuk,
            szűrtük és saját kategóriarendszerünkbe rendeztük.
          </p>

          <p>
            <strong>Hiteles sajtójelentések.</strong> A személyi és intézményi profilokat, illetve
            a kiemelt ügyeket rendszeresen szinkronizáljuk a{' '}
            <a href="https://telex.hu" target="_blank" rel="noopener noreferrer">Telex</a>,
            a <a href="https://444.hu" target="_blank" rel="noopener noreferrer">444.hu</a>,
            a <a href="https://hvg.hu" target="_blank" rel="noopener noreferrer">HVG</a>,
            a <a href="https://direkt36.hu" target="_blank" rel="noopener noreferrer">Direkt36</a> és
            az <a href="https://atlatszo.hu" target="_blank" rel="noopener noreferrer">Átlátszó</a> nyilvánosan
            elérhető cikkeivel. Kizárólag olyan megállapításokat jelenítünk meg, amelyek legalább
            egy ellenőrzött, névvel vállalt forrásra támaszkodnak.
          </p>

          <p>
            <strong>Nyilvánosan hozzáférhető dokumentumok.</strong> Ahol elérhető, felhasználjuk
            az OLAF vizsgálati összefoglalóit, az Állami Számvevőszék jelentéseit, az Európai Unió
            Bíróságának ítéleteit, jogerős bírósági határozatokat, közbeszerzési nyilvántartásokat,
            vagyonnyilatkozatokat és a kormányzati szervek sajtóközleményeit.
          </p>

          <h3 className="modszertan-h3">Szerkesztési elvek</h3>

          <p>
            <strong>Kettős forrás.</strong> Minden érintett személyhez, intézményhez vagy összeghez
            legalább két független forrást csatolunk. Egyedi, ellenőrizetlen állítások nem kerülnek
            közzétételre.
          </p>

          <p>
            <strong>Összegszerűség és kategorizálás.</strong> A feltüntetett kárösszegek sajtóban
            és vizsgálati iratokban szereplő becsült értékek, kivéve ahol jogerős bírósági ítélet
            pontos összeget tartalmaz. A kategóriák — pl.{' '}
            <em>közbeszerzési visszaélés</em>, <em>hűtlen kezelés</em> — jogi minősítések helyett
            közérthető gyűjtőkategóriák: jelzik az ügy jellegét, de nem helyettesítik az ügyészi
            vagy bírósági minősítést.
          </p>

          <p>
            <strong>Szerkesztői szelekció.</strong> Az oldalon kiemelt személyek és ügyek
            kiválasztásakor a dokumentált közpénzérintettség mértékét, a rendelkezésre álló
            forrásanyag minőségét és a közérdekű relevanciát vesszük figyelembe. Nem törekszünk
            teljességre — célunk az, hogy a legjobban dokumentált és legszélesebb körben ismert
            ügyeket tegyük átlátható módon hozzáférhetővé.
          </p>

          <h3 className="modszertan-h3">Korlátok</h3>

          <p>
            Az adatbázis nem helyettesíti a bírósági eljárást, és nem jogállású döntéshozatali eszköz.
            Az összefoglalók szükségszerűen leegyszerűsítik a jogi és ténybeli összefüggéseket.
            Lehetnek elavult, téves vagy hiányos adatok — ezek jelzéséhez visszajelzési csatornát
            biztosítunk. Az oldal jelenleg aktív fejlesztés alatt áll; az egyes ügyek státusza,
            az összegek és a forráshivatkozások rendszeres frissítés tárgyát képezik.
          </p>

          <h3 className="modszertan-h3">Jogi nyilatkozat</h3>

          <p>
            Jogerős ítélet hiányában valamennyi érintett személy ártatlannak tekintendő. Az oldalon
            szereplő megnevezések, összegek és kategóriák kizárólag nyilvánosan elérhető forrásokra
            támaszkodnak; azok nem minősülnek jogi állításnak, és nem fejeznek ki bűnösségre vonatkozó
            véleményt. Ha hibát észlel, vagy nyilvánosságra hozatalt érdemlő adathoz jutott,
            kérjük, forduljon hozzánk a tipp-beküldési felületen keresztül.
          </p>

          <h3 className="modszertan-h3">Frissítési logika</h3>

          <p>
            Az adatokat a csapat folyamatosan figyeli és bővíti. A személyi változások (lemondások,
            kirúgások) és a visszaszerzett vagyon rovata a napi sajtókövetés alapján, jellemzően
            1–2 órán belül frissülnek. A K-Monitor-adatbázisból történő szinkronizáció hetente
            történik.
          </p>

          <div className="modszertan-back">
            <Link href="/">← Vissza a főoldalra</Link>
          </div>

        </div>
      </section>
    </div>
  );
}
