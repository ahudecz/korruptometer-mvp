'use client';

import { fmtFtOrUnknown } from '@korr/shared/format';

export type PollOptionCardData = {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string | null;
  amountHuf: bigint | number | string | null;
  amountLabel: string | null;
  sourceUrl: string;
  sourceOutlet: string;
  isAreaNotCase: boolean;
  touchesEuFunds: boolean;
  alreadyReported: boolean;
};

export function OptionCard({
  option,
  number,
  selected,
  disabled,
  onToggle,
}: {
  option: PollOptionCardData;
  number: number;
  selected: boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
}) {
  const amountHuf =
    option.amountHuf === null
      ? null
      : typeof option.amountHuf === 'bigint'
        ? option.amountHuf
        : BigInt(option.amountHuf);
  const amountText = fmtFtOrUnknown(amountHuf, option.amountLabel);

  return (
    <div className={`poll-option-card${selected ? ' poll-option-card--selected' : ''}`}>
      <label className="poll-option-card-select">
        <input
          type="checkbox"
          checked={selected}
          disabled={disabled && !selected}
          onChange={() => onToggle(option.id)}
          aria-label={`${option.title} kiválasztása`}
        />
        <span className="poll-option-card-number">{number}</span>
        <div className="poll-option-card-body">
          <div className="poll-option-card-title-row">
            <span className="poll-option-card-title">{option.title}</span>
            <span className={`poll-option-card-amount${amountText === 'Nincs konkrét összeg' ? ' poll-option-card-amount--unknown' : ''}`}>
              {amountText}
            </span>
          </div>
          {(option.alreadyReported || option.touchesEuFunds || option.isAreaNotCase) && (
            <div className="poll-option-card-tags">
              {option.alreadyReported && <span className="poll-option-card-tag poll-option-card-tag--marquee">Kiemelt</span>}
              {option.touchesEuFunds && <span className="poll-option-card-tag poll-option-card-tag--eu">EU</span>}
              {option.isAreaNotCase && <span className="poll-option-card-tag poll-option-card-tag--meta">Terület</span>}
            </div>
          )}
          <p className="poll-option-card-desc">{option.shortDescription}</p>
          {option.longDescription && <p className="poll-option-card-long-desc">{option.longDescription}</p>}
          <a href={option.sourceUrl} target="_blank" rel="noopener noreferrer" className="poll-option-card-source">
            Forrás: {option.sourceOutlet} →
          </a>
        </div>
      </label>
    </div>
  );
}
