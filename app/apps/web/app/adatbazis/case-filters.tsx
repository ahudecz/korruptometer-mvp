'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type FormEvent } from 'react';

const OPEN_OPTIONS: Array<[string, string]> = [
  ['', 'Mindegyik'],
  ['open', 'Folyamatban'],
  ['closed', 'Lezárt'],
];
const DAMAGE_OPTIONS: Array<[string, string]> = [
  ['0', '0 Ft'],
  ['1000000000', '1 Mrd Ft'],
  ['5000000000', '5 Mrd Ft'],
  ['10000000000', '10 Mrd Ft'],
  ['50000000000', '50 Mrd Ft'],
];

export type ScandalFilterState = {
  q?: string;
  offence?: string;
  open?: string;
  minDamage?: string;
  sort?: string;
};

type Props = {
  offences: Array<{ code: string; label: string }>;
  initial: ScandalFilterState;
};

export function CaseFilters({ offences, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function buildHref(form: HTMLFormElement, opts: { reset?: boolean } = {}) {
    if (opts.reset) return '/adatbazis';
    const next = new URLSearchParams();
    const fd = new FormData(form);
    for (const [k, v] of fd.entries()) {
      const val = String(v).trim();
      if (val !== '' && val !== '0') next.set(k, val);
    }
    next.delete('off');
    return `/adatbazis${next.toString() ? `?${next.toString()}` : ''}`;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(() => router.push(buildHref(e.currentTarget)));
  }

  function onChange(e: FormEvent<HTMLFormElement>) {
    if (e.target instanceof HTMLSelectElement) {
      startTransition(() => router.push(buildHref(e.currentTarget)));
    }
  }

  function onReset(form: HTMLFormElement) {
    form.reset();
    startTransition(() => router.push(buildHref(form, { reset: true })));
  }

  return (
    <form onSubmit={onSubmit} onChange={onChange} aria-label="Adatbázis szűrése" role="search">
      <div className="db-controls">
        <div className="db-control search">
          <label htmlFor="q">Keresés</label>
          <input
            id="q"
            name="q"
            type="search"
            placeholder="Ügy, személy, intézmény…"
            defaultValue={initial.q ?? ''}
            autoComplete="off"
          />
        </div>
        <div className="db-control">
          <label htmlFor="f-offence">Jogsértés típusa</label>
          <select id="f-offence" name="offence" defaultValue={initial.offence ?? ''}>
            <option value="">Összes típus</option>
            {offences.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="db-control">
          <label htmlFor="f-open">Státusz</label>
          <select id="f-open" name="open" defaultValue={initial.open ?? ''}>
            {OPEN_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="db-control">
          <label htmlFor="f-damage">Min. kár</label>
          <select id="f-damage" name="minDamage" defaultValue={String(initial.minDamage ?? 0)}>
            {DAMAGE_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="db-control btn"
          onClick={(e) => onReset(e.currentTarget.form!)}
          disabled={pending}
        >
          <span>{pending ? 'Frissít…' : 'Szűrők törlése'}</span>
        </button>
      </div>
      <input type="hidden" name="sort" value={initial.sort ?? 'damage_desc'} />
    </form>
  );
}
