'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { OptionCard, type PollOptionCardData } from './option-card';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void },
      ) => string;
    };
  }
}

/**
 * A `/bejelentes` űrlap ma egy fix `'1x'` dev-tokent küld a Turnstile-mezőben
 * (nincs valódi kliens-oldali widget felhúzva) — ez éles környezetben nem
 * védene semmit, ha a szerver oldali secret nem a Cloudflare dev-bypass
 * kulcsa. Itt a szavazásnál egy tényleg működő widgetet húzunk fel, hogy a
 * FR-013 ("láthatatlan emberi-ellenőrzés") ténylegesen teljesüljön.
 */
function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string | null;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    if (window.turnstile) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, [siteKey]);

  useEffect(() => {
    if (!scriptLoaded || !siteKey || !ref.current || !window.turnstile) return;
    window.turnstile.render(ref.current, { sitekey: siteKey, callback: onToken });
  }, [scriptLoaded, siteKey, onToken]);

  if (!siteKey) return null;
  return <div ref={ref} className="poll-turnstile" />;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function VoteForm({
  questionSlug,
  minSelect,
  maxSelect,
  options,
  turnstileSiteKey,
  onVoted,
}: {
  questionSlug: string;
  minSelect: number;
  maxSelect: number;
  options: PollOptionCardData[];
  turnstileSiteKey: string | null;
  onVoted: (voteId: string, selectedIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [honeypot, setHoneypot] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
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
            turnstileToken,
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
    [selected, minSelect, maxSelect, questionSlug, turnstileToken, honeypot, onVoted],
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

      <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />

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
