'use client';

import { useCallback, useState } from 'react';

import { SECTION_LABELS_HU, SUBSCRIPTION_SECTIONS, type SubscriptionSection } from '@korr/shared/sections';

/**
 * 012-reader-subscriptions — a feliratkozó űrlap (FR-010, FR-011, FR-032,
 * FR-080, FR-089, FR-092).
 *
 * Az űrlap NEM kér nevet és semmilyen más szabad szöveget (FR-080). Ez az,
 * ami megakadályozza, hogy a megerősítő levél egy támadó szavait vigye egy
 * harmadik félnek — elsődleges védelem, nem egyszerűsítés.
 *
 * A ritmus KIÍRVA szerepel, nem választható: a `digest-draft` ma csak heti
 * ütemezésen fut, tehát egy naposként tárolt feliratkozó egyetlen elkészülő
 * összefoglalóhoz sem illeszkedne, és semmit nem kapna.
 */
type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'ok'; message: string }
  | { kind: 'paused'; message: string }
  | { kind: 'error'; message: string };

export function NewsletterCta() {
  const [email, setEmail] = useState('');
  const [sections, setSections] = useState<SubscriptionSection[]>([...SUBSCRIPTION_SECTIONS]);
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  const toggle = useCallback((section: SubscriptionSection) => {
    setSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
    );
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === 'sending') return;
    if (sections.length === 0) {
      setState({ kind: 'error', message: 'Válassz legalább egy témát.' });
      return;
    }
    setState({ kind: 'sending' });
    try {
      const res = await fetch('/api/hirlevel/feliratkozas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, sections, website }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, string> | null;
      if (res.status === 503) {
        setState({ kind: 'paused', message: data?.message ?? 'A feliratkozás átmenetileg szünetel.' });
        return;
      }
      if (!res.ok) {
        setState({ kind: 'error', message: data?.error ?? 'A beküldés nem sikerült.' });
        return;
      }
      setState({
        kind: 'ok',
        message: data?.message ?? 'Elküldtük a megerősítő levelet. Nézd meg a postaládád.',
      });
    } catch {
      setState({ kind: 'error', message: 'A beküldés nem sikerült.' });
    }
  }

  return (
    <form className="newsletter-cta-form" onSubmit={submit} noValidate>
      <div className="newsletter-cta-field">
        <label htmlFor="nl-email">E-mail cím</label>
        <input
          id="nl-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="pelda@gmail.com"
        />
      </div>

      <fieldset className="newsletter-cta-sections">
        <legend>Miről kérsz értesítést?</legend>
        <div className="newsletter-cta-section-grid">
          {SUBSCRIPTION_SECTIONS.map((section) => (
            <label key={section} className="newsletter-cta-check" htmlFor={`nl-${section}`}>
              <input
                id={`nl-${section}`}
                type="checkbox"
                name="sections"
                value={section}
                checked={sections.includes(section)}
                onChange={() => toggle(section)}
              />
              <span>{SECTION_LABELS_HU[section]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/*
        FR-089 — csali-mező. Négy dolog KELL egyszerre, és a `display: none`
        egyik sem: van bot, ami átugorja a display-none mezőket, és van
        jelszókezelő, ami kitölti őket — az utóbbi VALÓDI olvasót utasítana el.

        - képernyőn kívülre pozicionálva, nem elrejtve;
        - aria-hidden, hogy egy képernyőolvasó soha ne mondja ki (FR-011);
        - tabindex="-1", hogy billentyűzettel se lehessen belelépni;
        - autocomplete="off" és olyan mezőnév, amit egy jelszókezelő nem ismer
          fel címként vagy névként. A `website` biztonságos; az `email`, a
          `name` és a `tel` nem.
      */}
      <div className="newsletter-cta-hp" aria-hidden="true">
        <label htmlFor="nl-website">Weboldal</label>
        <input
          id="nl-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <p className="newsletter-cta-note">
        Hetente egy levél. Csak az e-mail címedet tároljuk, titkosítva, és a
        feliratkozás hálózati címének egy azonosítóját. Bármelyik levélből egy
        kattintással leiratkozhatsz. Részletek az{' '}
        <a href="/adatvedelem">adatvédelmi tájékoztatóban</a>.
      </p>

      <button className="newsletter-cta-btn" type="submit" disabled={state.kind === 'sending'}>
        {state.kind === 'sending' ? 'Küldés…' : 'Feliratkozom'}
      </button>

      <p className="newsletter-cta-status" role="status" aria-live="polite">
        {state.kind === 'ok' || state.kind === 'paused' || state.kind === 'error'
          ? state.message
          : ''}
      </p>
    </form>
  );
}
