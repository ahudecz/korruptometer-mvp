import Link from 'next/link';

export const metadata = {
  title: 'Whistleblower védelem – Kegyencjárat',
  description: 'Jogi tájékoztató a visszaélés-bejelentők védelméről Magyarországon.',
};

export default function WhistleblowerPage() {
  return (
    <div className="news-section-wrap">
      <section className="section" id="whistleblower">
        <div className="section-head">
          <div className="section-num">/ Whistleblower védelem</div>
          <h2 className="section-title">Véd a törvény.</h2>
        </div>

        <div className="modszertan-body">

          <p className="modszertan-lead">
            Ha olyan visszaélésről tudsz, ami közpénzzel, közhatalommal vagy korrupcióval
            függ össze, a bejelentésed nem csupán lehetséges — törvényi védelmed van
            hozzá. Ez az oldal összefoglalja a legfontosabb tudnivalókat.
          </p>

          <h3 className="modszertan-h3">Mi a jogi alap?</h3>

          <p>
            Az Európai Unió 2019-ben fogadta el a visszaélés-bejelentők védelméről szóló
            irányelvet (<strong>EU 2019/1937</strong>). Magyarország ezt 2023-ban ültette át
            a nemzeti jogba a <strong>2023. évi XXV. törvénnyel</strong> — „a visszaélések
            bejelentőinek védelméről."
          </p>

          <p>
            A törvény védi azt, aki közérdeket sértő, vagy annak sérelmébe torkollható
            magatartást jelent be — feltéve, hogy a bejelentésre alapos oka volt és
            jóhiszeműen cselekedett.
          </p>

          <h3 className="modszertan-h3">Mire terjed ki a védelem?</h3>

          <ul className="modszertan-list">
            <li>Elbocsátástól, hátrányos megkülönböztetéstől és retorzióktól védett vagy</li>
            <li>A bejelentő személyazonossága védett, ha belső vagy hatósági csatornán jelented be</li>
            <li>Ha bizonyítani tudod, hogy retorzió érte, megfordul a bizonyítási teher</li>
            <li>A jóhiszemű bejelentő büntetőjogi felelőssége korlátozott</li>
          </ul>

          <h3 className="modszertan-h3">Hol jelents be?</h3>

          <div className="adom-methods">
            <div className="adom-method">
              <div className="adom-method-title">Kegyencjárat – titkosított bejelentés</div>
              <div className="adom-method-desc">
                Az oldalon belüli bejelentési felület anonim üzenetküldést tesz lehetővé.
                Nem rögzítünk IP-címet, nem kérünk azonosítót.
              </div>
              <Link href="/bejelentes" className="adom-btn">
                Bejelentés tétele →
              </Link>
            </div>

            <div className="adom-method">
              <div className="adom-method-title">Alapvető Jogok Biztosa</div>
              <div className="adom-method-desc">
                A Visszaélés-bejelentési Iroda (VBI) a 2023. évi XXV. törvény alapján
                fogadja a bejelentéseket. Bizalmas és vizsgálati kötelezettséggel jár.
              </div>
              <a
                href="https://www.ajbh.hu"
                target="_blank"
                rel="noopener noreferrer"
                className="adom-btn"
              >
                ajbh.hu →
              </a>
            </div>

            <div className="adom-method">
              <div className="adom-method-title">Transparency International</div>
              <div className="adom-method-desc">
                A TI Magyarország whistleblower-tanácsadást nyújt és segít
                megtalálni a legalkalmasabb csatornát a bejelentéshez.
              </div>
              <a
                href="https://transparency.hu"
                target="_blank"
                rel="noopener noreferrer"
                className="adom-btn"
              >
                transparency.hu →
              </a>
            </div>
          </div>

          <h3 className="modszertan-h3">Mit teszünk a bejelentéssel?</h3>

          <p>
            A Kegyencjáratra érkező bejelentéseket a szerkesztőség kezeli. Nem publikálunk
            bejelentést automatikusan — minden esetben ellenőrzünk, és csak akkor jelenítjük
            meg az adatokat az adatbázisban, ha legalább egy nyilvánosan hivatkozható forrás
            is alátámasztja a tartalmat. A bejelentő személyazonosságát soha nem adjuk ki,
            és a bejelentővel nem lépünk kapcsolatba az általuk megadottakon kívül.
          </p>

          <h3 className="modszertan-h3">Fontos figyelmeztetések</h3>

          <ul className="modszertan-list">
            <li>Ez az oldal <strong>nem</strong> jogi tanácsadás — ügyvédhez fordulj, ha konkrét jogi kockázatod van</li>
            <li>A védelem feltétele a jóhiszeműség — szándékos félretájékoztatás nem védett</li>
            <li>A törvény nem véd meg minden retorzió ellen, csak a jogszabályban felsoroltaktól</li>
            <li>
              Ha állami szervekről jelentesz be, a belső csatornák kockázatosabbak lehetnek
              — ilyenkor a külső csatornák (TI, sajtó) biztonságosabbak
            </li>
          </ul>

          <div className="modszertan-back">
            <Link href="/bejelentes">Bejelentési felület →</Link>
            {' · '}
            <Link href="/">← Főoldal</Link>
          </div>

        </div>
      </section>
    </div>
  );
}
