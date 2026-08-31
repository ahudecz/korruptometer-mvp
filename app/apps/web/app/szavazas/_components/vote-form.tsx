'use client';

import { useCallback, useState } from 'react';
import { OptionCard, type PollOptionCardData } from './option-card';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function VoteForm({
  questionSlug,
  minSelect,
  maxSelect,
  options,
  onVoted,
}: {
  questionSlug: string;
  minSelect: number;
  maxSelect: number;
  options: PollOptionCardData[];
  onVoted: (voteId: string, selectedIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          if (next.size >= maxSelect) return prev; // FR-005 — a 6. kiválasztás nem engedélyezett
          next.add(id);
        }
        return next;
      });
    },
    [maxSelect],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (selected.size < minSelect) {
        setError('Válassz ki legalább egy ügyet.');
        return;
      }
      if (selected.size > maxSelect) {
        setError(`Legfeljebb ${maxSelect} ügyet választhatsz ki.`);
        return;
      }
      setState('submitting');
      setError(null);
      try {
        const res = await fetch('/api/poll/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionSlug,
            optionIds: [...selected],
            honeypot,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string; voteId?: string };
        if (!res.ok || !json.voteId) {
          setState('error');
          setError(json.error ?? 'A szavazat leadása nem sikerült. Próbáld újra.');
          return;
        }
        setState('success');
        onVoted(json.voteId, [...selected]);
      } catch {
        setState('error');
        setError('Hálózati hiba történt. Próbáld újra.');
      }
    },
    [selected, minSelect, maxSelect, questionSlug, honeypot, onVoted],
  );

  if (state === 'success') {
    return (
      <div className="poll-vote-success" role="status">
        Köszönjük, sikeresen leadtad a szavazatod!
      </div>
    );
  }

  return (
    <form className="poll-vote-form" onSubmit={handleSubmit}>
      <div className="poll-option-grid">
        {options.map((option, i) => (
          <OptionCard
            key={option.id}
            option={option}
            number={i + 1}
            selected={selected.has(option.id)}
            disabled={selected.size >= maxSelect}
            onToggle={toggle}
          />
        ))}
      </div>

      {/* Honeypot — rejtett a valódi felhasználók elől, de a form-parserek
          (botok) gyakran kitöltik; ha kitöltve érkezik, a szerver elutasítja
          a beküldést (FR-014). */}
      <div className="poll-honeypot" aria-hidden="true">
        <label htmlFor="poll-website">Weboldal</label>
        <input
          id="poll-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="poll-vote-submit-bar">
        <span className="poll-vote-count">
          {selected.size}/{maxSelect} kiválasztva
        </span>
        {error && <p className="poll-vote-error">{error}</p>}
        <button
          type="submit"
          className="poll-vote-submit"
          disabled={state === 'submitting' || selected.size < minSelect}
        >
          {state === 'submitting' ? 'Küldés…' : 'Szavazat leadása'}
        </button>
      </div>
    </form>
  );
}
