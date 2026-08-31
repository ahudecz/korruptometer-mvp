'use client';

import { useEffect, useRef, useState } from 'react';
import { VoteForm } from './vote-form';
import { ResultsSection } from './results-section';
import { ShareButton } from './share-button';
import type { PollOptionCardData } from './option-card';
import type { ResultBarOption } from './result-bars';

export type VoteFormClientOption = PollOptionCardData & { votes: number; sharePct: number };

const RESULTS_HASH = 'eredmenyek';

/**
 * Nézet-váltó a szavazóform és az eredmény-nézet (ResultBars) között (US1 +
 * US2), URL-horgonnyal megosztható eredmény-nézettel (US3 bővítés): a
 * `#eredmenyek` horgony közvetlenül az eredményekre nyit.
 */
export function VoteFormClient({
  questionSlug,
  minSelect,
  maxSelect,
  status,
  options,
  totalVotes,
  alreadyVoted,
  ownSelectionIds: serverOwnSelectionIds,
  turnstileSiteKey,
}: {
  questionSlug: string;
  minSelect: number;
  maxSelect: number;
  status: 'open' | 'closed';
  options: VoteFormClientOption[];
  totalVotes: number;
  alreadyVoted: boolean;
  ownSelectionIds: string[];
  turnstileSiteKey: string | null;
}) {
  const shareUrl =
    typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const [justVoted, setJustVoted] = useState(false);
  const [ownSelectionIds, setOwnSelectionIds] = useState<Set<string>>(
    new Set(serverOwnSelectionIds),
  );
  const [tab, setTab] = useState<'form' | 'results'>(() =>
    typeof window !== 'undefined' && window.location.hash === `#${RESULTS_HASH}` ? 'results' : 'form',
  );
  const resultsAnchorRef = useRef<HTMLDivElement>(null);

  const votingDone = alreadyVoted || justVoted || status === 'closed';
  const showResults = votingDone || tab === 'results';

  // Ha eredmény-nézetre váltunk (kézzel, horgonnyal, vagy szavazás után),
  // ugorjunk a nézet TETEJÉRE — ne maradjunk lent a szavazóform aljánál.
  useEffect(() => {
    if (showResults) {
      resultsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (typeof window !== 'undefined' && window.location.hash !== `#${RESULTS_HASH}`) {
        window.history.replaceState(null, '', `#${RESULTS_HASH}`);
      }
    } else if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [showResults]);

  const resultOptions: ResultBarOption[] = options.map((o) => ({
    id: o.id,
    title: o.title,
    votes: o.votes,
    sharePct: o.sharePct,
    amountHuf: o.amountHuf,
    amountLabel: o.amountLabel,
  }));

  const myPickTitles = [...ownSelectionIds]
    .map((id) => options.find((o) => o.id === id)?.title)
    .filter((t): t is string => !!t);

  return (
    <div className="poll-view">
      <div className="poll-toolbar">
        {!votingDone && (
          <div className="poll-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'form'}
              className={`poll-tab${tab === 'form' ? ' poll-tab--active' : ''}`}
              onClick={() => setTab('form')}
            >
              Szavazás
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'results'}
              className={`poll-tab${tab === 'results' ? ' poll-tab--active' : ''}`}
              onClick={() => setTab('results')}
            >
              Eredmények
            </button>
          </div>
        )}
        <ShareButton
          url={showResults ? `${shareUrl}#${RESULTS_HASH}` : shareUrl}
          title="Szavazás — Kegyencjárat"
          text={
            showResults
              ? 'Így alakul a Kegyencjárat friss szavazása — nézd meg az állást, és szólj hozzá te is!'
              : 'Ez itt a Kegyencjárat friss szavazása — nézd meg, és szólj hozzá te is!'
          }
          label={showResults ? 'Eredmény megosztása' : 'Szavazás megosztása'}
        />
      </div>

      {votingDone && (
        <div className="poll-voted-banner">
          <p>
            {status === 'closed'
              ? 'Ez a szavazás lezárult.'
              : justVoted
                ? 'Köszönjük, sikeresen leadtad a szavazatod!'
                : 'Ezzel a böngészővel már szavaztál ezen a kérdésen.'}
          </p>
          {myPickTitles.length > 0 && (
            <ShareButton
              url={shareUrl}
              title="A szavazatom — Kegyencjárat"
              text={`Leadtam a szavazatom a Kegyencjárat NVVH-szavazásán — szerintem ${myPickTitles.length === 1 ? 'ez legyen az egyik első ügy' : 'ezek legyenek az első ügyek között'}: ${myPickTitles.join(', ')}. Mondd el te is a véleményed!`}
              label="Megosztom, mire szavaztam"
              className="poll-share-button poll-share-button--picks"
            />
          )}
        </div>
      )}

      <div ref={resultsAnchorRef} id={RESULTS_HASH}>
        {showResults ? (
          <ResultsSection
            questionSlug={questionSlug}
            initialTotalVotes={totalVotes}
            initialOptions={resultOptions}
            ownSelectionIds={ownSelectionIds}
            onWantToVote={votingDone ? undefined : () => setTab('form')}
          />
        ) : (
          <VoteForm
            questionSlug={questionSlug}
            minSelect={minSelect}
            maxSelect={maxSelect}
            options={options}
            turnstileSiteKey={turnstileSiteKey}
            onVoted={(_voteId, selectedIds) => {
              setOwnSelectionIds(new Set(selectedIds));
              setJustVoted(true);
            }}
          />
        )}
      </div>
    </div>
  );
}
