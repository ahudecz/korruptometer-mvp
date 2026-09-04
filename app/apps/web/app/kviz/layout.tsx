import type { ReactNode } from 'react';

import { getDb } from '@/lib/db';
import { listQuizzes } from '@/lib/quiz-queries';
import { QuizSidebar } from './_components/quiz-sidebar';
import { PollBottomPromo } from '../szavazas/_components/poll-bottom-promo';
import { NewsletterCta } from '../_home/newsletter-cta';
import { TelegramChannelCard, hasTelegramChannel } from '../_home/telegram-channel-card';

export const metadata = {
  title: 'Kvízek — Kegyencjárat',
  description: 'Teszteld a tudásod a legnagyobb NER-botrányokról — feleletválasztós kvízek, azonnali visszajelzéssel.',
};

export default async function KvizLayout({ children }: { children: ReactNode }) {
  const quizzes = await listQuizzes(getDb());

  return (
    <main className="poll-page">
      <div className="poll-section-header">
        <span className="poll-section-eyebrow">Kvíz</span>
        <p className="poll-section-desc">
          Mennyire ismered a legnagyobb korrupciós ügyeket? Válaszolj a kérdésekre, és derítsd ki!
        </p>
      </div>
      <div className="poll-layout">
        <QuizSidebar quizzes={quizzes} />
        <div className="poll-content">{children}</div>
      </div>
      {/* Ugyanaz a terelés, mint a szavazóoldal alján (user kérés,
          2026-09-03: "ugyanaz a terelés kéne a kvíz részek alá... minden
          oldalra, és a végére is") — a layout aljára kerül, így minden
          /kviz oldalon (index + minden kvíz + a kvíz eredmény-képernyője
          után is) megjelenik, pont mint a szavazásnál. */}
      <PollBottomPromo />

      {/* Feliratkozás-blokk — user kérés, 2026-09-04: "tegyél be a végére
          egy feliratkozás blokkot, mobilon a videó alatt jelenjen meg...
          egy az egyben beteheted ide" — a nyitóoldal "ÉRTESÍTÉSEK"
          szekciójának (012-reader-subscriptions FR-092) szó szerinti
          másolata. Mivel a layout aljára kerül, a kvíz eredmény-
          képernyőjének (és annak videójának) MINDIG alá renderelődik —
          mobilon a natural stacking miatt automatikusan a videó alá esik. */}
      <section className="submission" id="hirlevel">
        <div className="submission-inner">
          <div className="submission-left">
            <h2>
              Szólunk, ha <em>történik</em> valami.
            </h2>
            <p>
              Amikor lemond vagy távozik egy NER-vezető, ítélet születik,
              feljelentés megy be, vagy megszűnik egy médium — arról szólunk.
              Nem hírlevél, nem reklám: csak az, ami felkerül az oldalra.
            </p>
            {hasTelegramChannel() ? (
              <div className="submission-assurance">
                <strong>Két út, válassz egyet</strong>
                A Telegram-csatornához nem adsz meg semmit, és mindent megkapsz.
                Az e-mailnél te választod ki a témákat, cserébe a címedet
                titkosítva tároljuk.
              </div>
            ) : (
              <div className="submission-assurance">
                <strong>Csak a cím kell</strong>
                Nevet nem kérünk. A címedet titkosítva tároljuk, és bármelyik
                levélből egy kattintással leiratkozhatsz.
              </div>
            )}
          </div>

          <div>
            <TelegramChannelCard />
            <div className="chan">
              <div className="chan-head">
                <span className="chan-title">E-mail összefoglaló</span>
                <span className="chan-when">Hetente</span>
              </div>
              <div className="chan-body">
                <p>
                  Egy levél hetente, csak a kipipált témákról. Minden levelet
                  szerkesztő néz át, mielőtt kimegy.
                </p>
                <NewsletterCta />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
