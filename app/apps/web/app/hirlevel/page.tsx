import { NewsletterCta } from '@app/_home/newsletter-cta';

export const metadata = {
  title: 'Hírlevél',
  description: 'Kérj értesítést a lemondásokról, ítéletekről és megszűnt médiumokról.',
};

/**
 * 012-reader-subscriptions FR-092 — a feliratkozás három belépési pontjának
 * egyike: a saját oldal. A másik kettő a főoldal számozott szekciója és a
 * lábléc linkje.
 */
export default function HirlevelPage() {
  return (
    <div className="news-section-wrap">
      <section className="section" id="hirlevel">
        <div className="section-head">
          <div className="section-num">/ Hírlevél</div>
          <h2 className="section-title">Szólunk, ha történik valami.</h2>
        </div>

        <p className="section-lead">
          Hetente egy levél arról, ki mondott le, kit ítéltek el, melyik médium
          szűnt meg. Válaszd ki, mi érdekel. A cím megerősítéséig semmit nem
          küldünk, és bármelyik levélből egy kattintással leiratkozhatsz.
        </p>

        <NewsletterCta />

        <div className="modszertan-body">
          <h3 className="modszertan-h3">Mit tárolunk rólad?</h3>
          <p>
            Az e-mail címedet, titkosítva; a kiválasztott témákat; és a
            feliratkozás, illetve a megerősítés hálózati címének egy
            visszafejthetetlen azonosítóját. Ez utóbbi is személyes adat, ezért
            ugyanúgy törlődik. Nevet és semmilyen más szabad szöveget nem kérünk.
          </p>
          <p>
            A jogalap a hozzájárulásod (GDPR 6. cikk (1) a) pont), amit a
            megerősítő levélben adsz meg. Leiratkozás után 30 nappal töröljük a
            címedet és a hálózati azonosítókat. Csak annak a bizonyítéka marad
            meg, hogy volt hozzájárulás, és hogy erre a címre nem küldünk többet.
          </p>
          <p>
            Azonnali törlést a{' '}
            <a href="mailto:hello@kegyencjarat.hu">hello@kegyencjarat.hu</a> címen
            kérhetsz. Részletek az{' '}
            <a href="/adatvedelem">adatvédelmi tájékoztatóban</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
