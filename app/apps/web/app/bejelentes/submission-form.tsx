'use client';

import { useState, type FormEvent } from 'react';

const CRIMES = [
  'Korrupció',
  'Hivatali visszaélés',
  'Közbeszerzési csalás',
  'EU-csalás',
  'Túlárazás',
  'Önkormányzat',
  'Kartell',
  'Egyéb',
];

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ok'; ref: string }
  | { kind: 'err'; message: string };

export function SubmissionForm() {
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });
  const [allowContact, setAllowContact] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: 'pending' });

    const form = e.currentTarget;
    const fd = new FormData(form);
    // Map checkbox crimes to a single comma-separated field the schema accepts.
    const crimes = CRIMES.filter((c) => fd.get(`crime:${c}`) === 'on');
    fd.delete('crime:Korrupció');
    fd.delete('crime:Hivatali visszaélés');
    fd.delete('crime:Közbeszerzési csalás');
    fd.delete('crime:EU-csalás');
    fd.delete('crime:Túlárazás');
    fd.delete('crime:Önkormányzat');
    fd.delete('crime:Kartell');
    fd.delete('crime:Egyéb');
    fd.set('crimes', crimes.join(','));
    if (!fd.get('turnstileToken')) fd.set('turnstileToken', '1x');
    fd.set('allowContact', allowContact ? 'true' : 'false');

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        body: fd,
      });
      const body = (await res.json()) as { ref?: string; error?: string };
      if (!res.ok) {
        setState({ kind: 'err', message: body.error ?? 'Ismeretlen hiba.' });
        return;
      }
      setState({ kind: 'ok', ref: body.ref ?? '?' });
    } catch (err) {
      setState({
        kind: 'err',
        message: err instanceof Error ? err.message : 'Hálózati hiba.',
      });
    }
  }

  if (state.kind === 'ok') {
    return (
      <div className="empty-state" style={{ textAlign: 'left' }}>
        <h3 style={{ marginBottom: 8 }}>Köszönjük — beérkezett.</h3>
        <p>
          Mentsd el a bejelentési azonosítódat:
          <strong style={{ fontFamily: 'Archivo Narrow, monospace', marginLeft: 8 }}>
            {state.ref}
          </strong>
        </p>
        <p style={{ marginTop: 8 }}>
          A szerkesztőség 14 napon belül átolvassa. Ha visszahívást kértél,
          az írj-vissza-lehetőséggel közvetlenül megkeresünk.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="db-toolbar" style={{ display: 'grid', gap: 16 }}>
      <input
        name="suspectName"
        required
        minLength={2}
        placeholder="Gyanúsított neve (legalább 2 karakter)"
        aria-label="Gyanúsított neve"
      />
      <input
        name="suspectPosition"
        placeholder="Pozíció (opcionális)"
        aria-label="Pozíció"
      />
      <input
        name="suspectRegion"
        placeholder="Régió / megye (opcionális)"
        aria-label="Régió"
      />
      <input
        name="period"
        placeholder="Mikor történt? (pl. 2023 ősze)"
        aria-label="Időszak"
      />
      <input
        type="number"
        name="estimatedAmount"
        min={0}
        placeholder="Becsült érintett összeg (Ft) — opcionális"
        aria-label="Becsült érintett összeg"
      />

      <fieldset
        style={{
          border: '1px solid var(--line)',
          padding: 12,
          borderRadius: 12,
        }}
      >
        <legend
          style={{
            padding: '0 6px',
            fontSize: 12,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
          }}
        >
          Gyanús cselekmények (legalább egy)
        </legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {CRIMES.map((c) => (
            <label key={c} style={{ display: 'flex', gap: 6, fontSize: 14 }}>
              <input type="checkbox" name={`crime:${c}`} />
              {c}
            </label>
          ))}
        </div>
      </fieldset>

      <textarea
        name="summary"
        required
        minLength={20}
        rows={6}
        placeholder="Részletes leírás (legalább 20 karakter, legfeljebb 8000)"
        aria-label="Összefoglaló"
        style={{
          padding: 12,
          border: '1px solid var(--line-strong)',
          borderRadius: 12,
          font: 'inherit',
        }}
      />

      <textarea
        name="sourceUrls"
        rows={3}
        placeholder="Linkek nyilvános forrásokra, soronként egy URL"
        aria-label="Forrás-URL-ek"
        style={{
          padding: 12,
          border: '1px solid var(--line-strong)',
          borderRadius: 12,
          font: 'inherit',
        }}
      />

      <input
        type="file"
        name="files"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.txt,.mp3,.wav,.ogg"
        aria-label="Csatolmányok (max 10 fájl)"
      />

      <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          name="allowContact"
          checked={allowContact}
          onChange={(e) => setAllowContact(e.target.checked)}
        />
        Visszahívást szeretnék — itt megadhatom az e-mail-címemet és a nevemet.
      </label>
      {allowContact && (
        <>
          <input
            name="reporterEmail"
            type="email"
            placeholder="E-mail (titkosítva tároljuk)"
            aria-label="E-mail"
          />
          <input
            name="reporterName"
            placeholder="Név (titkosítva tároljuk)"
            aria-label="Név"
          />
        </>
      )}

      <input type="hidden" name="turnstileToken" defaultValue="1x" />

      <button
        type="submit"
        className="btn btn-primary"
        disabled={state.kind === 'pending'}
        style={{ alignSelf: 'flex-start' }}
      >
        {state.kind === 'pending' ? 'Küldés…' : 'Bejelentés elküldése'}
      </button>

      {state.kind === 'err' && (
        <div className="empty-state" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
          {state.message}
        </div>
      )}
    </form>
  );
}
