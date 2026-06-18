import Link from 'next/link';

export const metadata = {
  title: 'Forráshivatkozások – Kegyencjárat',
  description: 'Az adatbázisban felhasznált partneri adatbázisok, sajtóforrások és hatósági dokumentumok teljes listája.',
};

function SourceEntry({
  name,
  url,
  label,
  children,
}: {
  name: string;
  url: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="forras-entry">
      <div className="forras-entry-head">
        <a href={url} target="_blank" rel="noopener noreferrer" className="forras-entry-name">
          {name}
        </a>
        <span className="forras-entry-label">{label}</span>
      </div>
      <p className="forras-entry-desc">{children}</p>
    </div>
  );
}

export default function ForrashivatkozasokPage() {
  return (
    <div className="news-section-wrap">
      <section className="section" id="forrashivatkozasok">
        <div className="section-head">
          <div className="section-num">/ Forráshivatkozások</div>
          <h2 className="section-title">Honnan jönnek az adatok.</h2>
        </div>

        <div className="modszertan-body">

          <p className="modszertan-lead">
            Az adatbázis mögötti forrásokat átlátható módon szeretnénk dokumentálni.
            Az alábbiakban felsoroljuk, milyen szervezetektől, szerkesztőségektől és
            hatóságoktól gyűjtjük az információkat — és azt is, hogy pontosan mire
            használjuk az egyes forrástípusokat.
          </p>

          {/* ── 1. Partneri adatbázis ── */}
          <h3 className="modszertan-h3">Partneri adatbázis</h3>

          <SourceEntry
            name="K-Monitor Közhasznú Egyesület"
            url="https://k-monitor.hu"
            label="Elsődleges strukturált forrás"
          >
            A K-Monitor 2008 óta gyűjti és dokumentálja a magyarországi korrupciós eseteket.
            Adatbázisuk jelenleg 64&nbsp;000+ dokumentált ügyet tartalmaz, bírósági iratokra,
            közbeszerzési nyilvántartásokra és sajtóanyagokra támaszkodva. Tőlük vesszük az
            esetazonosítókat, a becsült kárösszegeket, az érintett személyek és intézmények
            adatait, valamint az ügyekhez tartozó elsődleges forráslinkeket. Az általuk gyűjtött
            adatokat feldolgoztuk és saját kategóriarendszerünkbe szűrtük — nem vesszük át őket
            változtatás nélkül.
          </SourceEntry>

          <SourceEntry
            name="aHang – Közösségi kampányplatform"
            url="https://ahang.hu"
            label="Nyomozói anyagok"
          >
            Az aHang civil szervezet <a href="https://ahang.hu/lopnak/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Lopnak! projektje</a> részletes,
            közérthető formában dokumentálja a NER-közeli vagyon- és közpénzügyletek legfontosabb
            eseteit. Számos ügynél az ő összefoglalóik alapján dolgoztuk ki az adatbázisunk leírásait
            és kategóriáit. A galériában szereplő politikusok és közszereplők képeit több esetben
            szintén tőlük vettük át.
          </SourceEntry>

          {/* ── 2. Rendszeres sajtóforrások ── */}
          <h3 className="modszertan-h3">Rendszeres sajtóforrások</h3>
          <p style={{ marginBottom: 24 }}>
            Az alábbi szerkesztőségek cikkeit naponta figyeljük és szinkronizáljuk
            a személyi változások, az aktív ügyek és a kiemelt esetek frissítéséhez.
            Kizárólag névvel vállalt, ellenőrzött forrású anyagokat használunk fel.
          </p>

          <SourceEntry
            name="Telex"
            url="https://telex.hu"
            label="Napi frissítés"
          >
            Magyarország legnagyobb független hírportálja. Közpénz, korrupció, politika és
            elszámoltathatóság témájú cikkeit rendszeresen feldolgozzuk — különösen az NKA-,
            MNB- és Matolcsy-ügyeket, valamint a 2026-os rendszerváltás utáni eseményeket.
          </SourceEntry>

          <SourceEntry
            name="444.hu"
            url="https://444.hu"
            label="Napi frissítés"
          >
            Független politikai és közéleti portál. Elsősorban a Rogán-, Tiborcz- és
            Mészáros-ügyek, a TAO-rendszer, a közbeszerzési visszaélések és az OFAC-szankciók
            dokumentálásához használjuk anyagaikat.
          </SourceEntry>

          <SourceEntry
            name="HVG"
            url="https://hvg.hu"
            label="Napi frissítés"
          >
            Gazdasági és közéleti hetilap, erős online jelenléttel. Elsősorban gazdasági
            visszaélések, vagyonosodási ügyek és a Lázár-csoport üzleti érdekeltségeinek
            feltárásához támaszkodunk anyagaikra.
          </SourceEntry>

          <SourceEntry
            name="Direkt36"
            url="https://direkt36.hu"
            label="Nyomozói anyagok"
          >
            Magyarország vezető nyomozóriport-szerkesztősége. Mélyanyagaikat — különösen
            a letelepedési kötvénybotrányhoz, a Rogán-hálózathoz és a külföldi összefüggésekhez
            kötődőket — primer forrásként kezeljük.
          </SourceEntry>

          <SourceEntry
            name="Átlátszó"
            url="https://atlatszo.hu"
            label="Nyomozói anyagok"
          >
            Közadatok és közpénz-átláthatóság specializált portálja. Tiborcz-, Elios- és
            ingatlanvagyonosodási ügyekben, valamint az állami vagyon magánosításának
            dokumentálásában elsődleges forrásként használjuk anyagaikat.
          </SourceEntry>

          {/* ── 3. Hatósági és intézményi dokumentumok ── */}
          <h3 className="modszertan-h3">Hatósági és intézményi dokumentumok</h3>

          <SourceEntry
            name="OLAF – Európai Csalás Elleni Hivatal"
            url="https://anti-fraud.ec.europa.eu"
            label="EU vizsgálati összefoglalók"
          >
            Az OLAF vizsgálati összefoglalóit és ajánlásait felhasználjuk minden olyan ügynél,
            ahol EU-s forrás érintett (pl. Elios-ügy, kastélyprogram, NKA-pályázatok).
            Kizárólag nyilvánosan közzétett dokumentumokat hivatkozunk.
          </SourceEntry>

          <SourceEntry
            name="Állami Számvevőszék (ÁSZ)"
            url="https://asz.hu"
            label="Hatósági jelentések"
          >
            Az ÁSZ közzétett és kiszivárgott jelentés-tervezeteit felhasználjuk — különösen
            az MNB-alapítványok vagyonvesztésének, az egyházi ingatlan-visszaadások és az
            állami vagyonkezelés dokumentálásában.
          </SourceEntry>

          <SourceEntry
            name="Európai Unió Bírósága"
            url="https://curia.europa.eu"
            label="Bírósági ítéletek"
          >
            A Paks II. állami támogatásának megsemmisítéséről szóló 2025-ös ítéletet, valamint
            az uniós versenyjogi döntéseket elsődleges jogi forrásként kezeljük.
          </SourceEntry>

          <SourceEntry
            name="Közbeszerzési Hatóság"
            url="https://kozbeszerzes.hu"
            label="Tenderadatok"
          >
            A közbeszerzési szerződések, nyertes ajánlattevők és érintett összegek ellenőrzéséhez
            a Közbeszerzési Hatóság nyilvános keresőjét használjuk — különösen a Mészáros-,
            Lázár- és Balásy-ügyeknél.
          </SourceEntry>

          <SourceEntry
            name="Országgyűlési vagyonnyilatkozatok"
            url="https://www.parlament.hu/keresheto-vagyonnyilatkozatok-kepviselok"
            label="Képviselői adatok"
          >
            A képviselők nyilvánosan elérhető vagyonnyilatkozatait felhasználjuk a személyi
            profiloknál feltüntetett vagyoni adatok alátámasztásához.
          </SourceEntry>

          {/* ── 4. Egyéb hivatkozott szerkesztőségek ── */}
          <h3 className="modszertan-h3">Egyéb hivatkozott szerkesztőségek</h3>
          <p style={{ marginBottom: 24 }}>
            Az alábbi szerkesztőségek anyagait eseti jelleggel, nem rendszeres szinkronizációval
            használjuk fel — akkor, ha egy-egy ügynél ők hozták az elsőként közölt vagy
            legjobban dokumentált anyagot.
          </p>

          <SourceEntry
            name="Transparency International Magyarország"
            url="https://transparency.hu"
            label="Civil szervezet"
          >
            A TI Magyarország büntetőfeljelentéseit (pl. Semjén-vadászatok), éves
            korrupció-érzékelési adatait és rendszer-szintű elemzéseit hivatkozzuk.
          </SourceEntry>

          <SourceEntry
            name="Magyar Narancs"
            url="https://magyarnarancs.hu"
            label="Eseti"
          >
            Elsősorban a Pharaon-ügyhöz és az Orbán-rezidencia körüli korai nyomozóanyagokhoz
            hivatkozzuk.
          </SourceEntry>

          <SourceEntry
            name="Válasz Online"
            url="https://valaszonline.hu"
            label="Eseti"
          >
            A kastélyprogram összeomlásának dokumentálásához, a NER-alapítványi vagyonkezelési
            anomáliák feltárásához és a Zsigmond-páncél ügyéhez használjuk anyagaikat.
          </SourceEntry>

          <SourceEntry
            name="Nyugati Fény"
            url="https://nyugatifeny.hu"
            label="Eseti"
          >
            {'A „Jövő Nemzedék Földje" alapítványi nyereség feltárásához (Lázár-ügy) hivatkozzuk.'}
          </SourceEntry>

          <SourceEntry
            name="Energiaklub"
            url="https://energiaklub.hu"
            label="Eseti"
          >
            A Paks II. beruházás korrupciós kockázatainak elemzéséhez támaszkodunk
            szakpolitikai anyagaikra.
          </SourceEntry>

          <SourceEntry
            name="Szabad Európa (RFE/RL)"
            url="https://www.szabadeuropa.hu"
            label="Eseti"
          >
            Paks II. és energetikai szerződések kapcsán, ahol a külföldi összefüggések
            dokumentálásához nemzetközi sajtóanyagra is szükség van.
          </SourceEntry>

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
