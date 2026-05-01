'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type FormEvent } from 'react';

import type { CaseQuery } from '@korr/shared/schemas/cases';
import type { SortValue } from '@korr/shared/cursor';

const STATUS_OPTIONS = ['', 'Lezárva', 'Vádemelés', 'Folyamatban'] as const;
const AMOUNT_OPTIONS: Array<[string, string]> = [
  ['0', '0 Ft'],
  ['500000000', '500 M Ft'],
  ['1000000000', '1 Mrd Ft'],
  ['5000000000', '5 Mrd Ft'],
  ['10000000000', '10 Mrd Ft'],
];
const YEAR_OPTIONS = ['', '2017', '2018', '2019', '2020', '2021', '2022', '2023'];

type Props = {
  regions: string[];
  initial: CaseQuery;
  sortLabels: Record<SortValue, string>;
};

export function CaseFilters({ regions, initial }: Props) {
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
    next.delete('cursor');
    return `/adatbazis${next.toString() ? `?${next.toString()}` : ''}`;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(() => router.push(buildHref(e.currentTarget)));
  }

  function onChange(e: FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLSelectElement) {
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
            placeholder="Név, pozíció, kulcsszó…"
            defaultValue={initial.q ?? ''}
            autoComplete="off"
          />
        </div>
        <div className="db-control">
          <label htmlFor="f-status">Státusz</label>
          <select id="f-status" name="status" defaultValue={initial.status ?? ''}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'Mindegyik' : s}
              </option>
            ))}
          </select>
        </div>
        <div className="db-control">
          <label htmlFor="f-region">Régió</label>
          <select id="f-region" name="region" defaultValue={initial.region ?? ''}>
            <option value="">Összes régió</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="db-control">
          <label htmlFor="f-amount">Min. kár</label>
          <select
            id="f-amount"
            name="minAmount"
            defaultValue={String(initial.minAmount ?? 0)}
          >
            {AMOUNT_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="db-control">
          <label htmlFor="f-year">Évtől</label>
          <select
            id="f-year"
            name="caseYearFrom"
            defaultValue={String(initial.caseYearFrom ?? '')}
          >
            <option value="">Összes év</option>
            {YEAR_OPTIONS.filter(Boolean).map((y) => (
              <option key={y} value={y}>
                {y}
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
      <input type="hidden" name="sort" value={initial.sort} />
    </form>
  );
}
