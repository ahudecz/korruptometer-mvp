'use client';

import { useEffect, useState } from 'react';
import { ResultBars, type ResultBarOption } from './result-bars';
import { TwoCasesPromo } from './two-cases-promo';

type PollApiResponse = {
  totalVotes: number;
  options: ResultBarOption[];
};

/**
 * Kliens-oldalon frissíti magát a `GET /api/poll`-ból, hogy a legfrissebb
 * szavazatszámokat mutassa (pl. közvetlenül a saját szavazat leadása után,
 * amikor a szerver-oldalról érkezett props már egy szavazattal el van
 * maradva). Az edge-cache miatt ez sem terheli feleslegesen az adatbázist.
 */
export function ResultsSection({
  questionSlug,
  initialTotalVotes,
  initialOptions,
  ownSelectionIds,
  onWantToVote,
}: {
  questionSlug: string;
  initialTotalVotes: number;
  initialOptions: ResultBarOption[];
  ownSelectionIds?: ReadonlySet<string>;
  onWantToVote?: () => void;
}) {
  const [data, setData] = useState<PollApiResponse>({
    totalVotes: initialTotalVotes,
    options: initialOptions,
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/poll?slug=${encodeURIComponent(questionSlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: PollApiResponse | null) => {
        if (!cancelled && json) setData(json);
      })
      .catch(() => {
        /* marad a szerver-oldali kezdőérték, nem törik el a nézet */
      });
    return () => {
      cancelled = true;
    };
  }, [questionSlug]);

  return (
    <>
      {/* Mobile-first: ez az eredmény-nézet első eleme, hogy szavazás után
          azonnal, görgetés nélkül látszódjon (user report, 2026-09-02 —
          99% bounce rate szavazás után). */}
      <TwoCasesPromo />
      <ResultBars
        options={data.options}
        totalVotes={data.totalVotes}
        ownSelectionIds={ownSelectionIds}
        onWantToVote={onWantToVote}
      />
    </>
  );
}
