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
            akiknek elege lett. Nincs mögöttünk médiacég, párt, szponzor vagy
            újságírói háttér. Csak dühünk és egy AI-előfizetés.
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

          <h3 className="modszertan-h3">Csatlakozni szeretnél?</h3>

          <p>
            Ha az ellenőrzésben, adatgyűjtésben vagy jogi háttérrel szeretnél segíteni,
            írj a <a href="mailto:dpo@korruptometer.hu">dpo@korruptometer.hu</a> címre.
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
