'use client';

import { useEffect, useState } from 'react';
import { ResultBars, type ResultBarOption } from './result-bars';

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
    <ResultBars
      options={data.options}
      totalVotes={data.totalVotes}
      ownSelectionIds={ownSelectionIds}
      onWantToVote={onWantToVote}
    />
  );
}
