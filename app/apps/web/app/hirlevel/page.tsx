import { NewsletterCta } from '@app/_home/newsletter-cta';
import { TelegramChannelCard, hasTelegramChannel } from '@app/_home/telegram-channel-card';

export const metadata = {
  title: 'Értesítések',
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
          <div className="section-num">/ Értesítések</div>
          <h2 className="section-title">Szólunk, ha történik valami.</h2>
        </div>

        {/* A "két út" csak akkor igaz, ha a csatorna tényleg létezik. Amíg
            a TelegramChannelCard el van rejtve, ez a mondat olyan választást
            ígérne, amit az olvasó nem lát sehol. */}
        <p className="section-lead">
          Amikor lemond vagy távozik egy NER-vezető, ítélet születik,
          feljelentés megy be, vagy megszűnik egy médium — arról szólunk. Nem
          hírlevél, nem reklám: csak az, ami felkerül az oldalra.
          {hasTelegramChannel() ? ' Két úton kérheted; válassz egyet, vagy mindkettőt.' : ''}
        </p>

        <TelegramChannelCard />

        <div className="chan">
          <div className="chan-head">
            <span className="chan-title">E-mail összefoglaló</span>
            <span className="chan-when">Hetente</span>
          </div>
          <div className="chan-body">
            <p>
              Egy levél hetente, csak a kipipált témákról. Minden levelet
              szerkesztő néz át, mielőtt kimegy. A cím megerősítéséig semmit
              nem küldünk, és bármelyik levélből egy kattintással
              leiratkozhatsz.
            </p>
            <NewsletterCta />
          </div>
        </div>

        <div className="modszertan-body">
          <h3 className="modszertan-h3">Mit tárolunk rólad?</h3>
          <p>
            Az e-mail címedet, titkosítva; a kiválasztott témákat; és a
            feliratkozás, illetve a megerősítés hálózati címének egy
            visszafejthetetlen azonosítóját. Ez utóbbi is személyes adat, ezért
            ugyanúgy törlődik. Nevet és semmilyen más szabad szöveget nem kérünk.
          </p>
          <p>
            A leveleket a Resend küldi ki. A küldési naplóikban a címed 30
            napig megmarad — ennyi a szolgáltató minden csomagján, és nem
            állítható rövidebbre.
            {hasTelegramChannel()
              ? ' A Telegram-csatornánál ilyen nincs, mert ott semmit nem adsz meg.'
              : ''}
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
