import Link from 'next/link';
import { fmtFtOrUnknown } from '@korr/shared/format';
import { sortByVotesDesc } from '@/lib/poll-results';
import { POLL_OPTION_LINKS } from './poll-option-links';

export type ResultBarOption = {
  id: string;
  title: string;
  votes: number;
  sharePct: number;
  amountHuf: bigint | number | string | null;
  amountLabel: string | null;
};

/**
 * Kormany.hu-stílusú vízszintes csíkok — a csík hossza a szavazatarányt
 * mutatja (FR-008), csökkenő sorrendben. Az összeg csak másodlagos infó
 * (US2 döntés — a csík itt a szavazatokról szól, nem az ügy Ft-értékéről).
 */
export function ResultBars({
  options,
  totalVotes,
  ownSelectionIds,
  onWantToVote,
}: {
  options: ResultBarOption[];
  totalVotes: number;
  ownSelectionIds?: ReadonlySet<string>;
  /** Ha megadva, egy "Szavazok" gomb jelenik meg — annak, aki még nem szavazott, de az eredményeket nézi (US2 megosztás-eset). */
  onWantToVote?: () => void;
}) {
  if (totalVotes === 0) {
    return (
      <div className="poll-results-empty">
        <p>Még nem érkezett szavazat — légy te az első!</p>
        {onWantToVote && (
          <button type="button" className="poll-vote-cta" onClick={onWantToVote}>
            Szavazok
          </button>
        )}
      </div>
    );
  }

  const sorted = sortByVotesDesc(options);
  const maxSharePct = Math.max(...sorted.map((o) => o.sharePct), 1);

  return (
    <div className="poll-results">
      <div className="poll-results-head">
        <p className="poll-results-total">Eddig {totalVotes} szavazat érkezett.</p>
        {onWantToVote && (
          <button type="button" className="poll-vote-cta" onClick={onWantToVote}>
            Szavazok
          </button>
        )}
      </div>
      <ol className="poll-result-list">
        {sorted.map((option) => {
          const isOwn = ownSelectionIds?.has(option.id) ?? false;
          const amountHuf =
            option.amountHuf === null
              ? null
              : typeof option.amountHuf === 'bigint'
                ? option.amountHuf
                : BigInt(option.amountHuf);
          return (
            <li key={option.id} className={`poll-result-row${isOwn ? ' poll-result-row--own' : ''}`}>
              <div className="poll-result-row-head">
                <span className="poll-result-title">
                  {option.title}
                  {isOwn && <span className="poll-result-own-badge">a te választásod</span>}
                </span>
                <span className="poll-result-pct">{option.sharePct}%</span>
              </div>
              <div className="poll-result-bar-track">
                <div
                  className="poll-result-bar"
                  style={{ width: `${(option.sharePct / maxSharePct) * 100}%` }}
                />
              </div>
              <div className="poll-result-row-foot">
                <span>{option.votes} szavazat</span>
                <span>{fmtFtOrUnknown(amountHuf, option.amountLabel)}</span>
              </div>
              {POLL_OPTION_LINKS[option.title] && (
                <Link href={POLL_OPTION_LINKS[option.title]!} className="poll-result-row-link">
                  Nézd meg az ügy legfrissebb híreit →
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
