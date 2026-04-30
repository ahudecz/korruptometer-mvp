'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, type FormEvent } from 'react';

import type { CaseQuery } from '@korr/shared/schemas/cases';
import type { SortValue } from '@korr/shared/cursor';

const STATUS_OPTIONS = ['', 'Lezárva', 'Vádemelés', 'Folyamatban'] as const;
const SECTOR_OPTIONS = [
  '',
  'Közbeszerzés',
  'Önkormányzat',
  'Állami vállalat',
  'EU pályázat',
  'Egészségügy',
  'Egyéb',
] as const;

const SORT_VALUES: SortValue[] = ['amount_desc', 'amount_asc', 'year_desc', 'name_asc'];

type Props = {
  regions: string[];
  initial: CaseQuery;
  sortLabels: Record<SortValue, string>;
};

export function CaseFilters({ regions, initial, sortLabels }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  function buildHref(form: HTMLFormElement, opts: { reset?: boolean } = {}) {
    const next = new URLSearchParams();
    if (opts.reset) {
      return '/adatbazis';
    }
    const fd = new FormData(form);
    for (const [k, v] of fd.entries()) {
      const val = String(v).trim();
      if (val !== '') next.set(k, val);
    }
    // Drop the cursor — we're reissuing the query from page 1.
    next.delete('cursor');
    return `/adatbazis${next.toString() ? `?${next.toString()}` : ''}`;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const href = buildHref(e.currentTarget);
    startTransition(() => router.push(href));
  }

  function onReset(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    setTimeout(() => {
      startTransition(() => router.push(buildHref(form, { reset: true })));
    }, 0);
  }

  return (
    <form
      onSubmit={onSubmit}
      onReset={onReset}
      aria-label="Adatbázis szűrése"
      role="search"
      style={{ marginTop: 16 }}
    >
      <div className="db-toolbar">
        <input
          type="search"
          name="q"
          placeholder="Keresés (név, pozíció, régió)…"
          defaultValue={initial.q ?? ''}
          aria-label="Keresés"
        />
        <select name="status" defaultValue={initial.status ?? ''} aria-label="Státusz">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'Bármilyen státusz' : s}
            </option>
          ))}
        </select>
        <select name="region" defaultValue={initial.region ?? ''} aria-label="Régió">
          <option value="">Bármilyen régió</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select name="sector" defaultValue={initial.sector ?? ''} aria-label="Szektor">
          {SECTOR_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'Bármilyen szektor' : s}
            </option>
          ))}
        </select>
        <input
          type="number"
          name="minAmount"
          min={0}
          placeholder="Min. kár (Ft)"
          defaultValue={initial.minAmount ?? ''}
          aria-label="Minimum kár"
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          Szűrés
        </button>
      </div>

      <div className="db-toolbar" style={{ marginBottom: 12 }}>
        <input
          type="number"
          name="minSentenceYears"
          min={0}
          placeholder="Min. börtönévek"
          defaultValue={initial.minSentenceYears ?? ''}
          aria-label="Minimum kiszabott évek"
        />
        <input
          type="number"
          name="caseYearFrom"
          min={1990}
          max={2100}
          placeholder="Évtől"
          defaultValue={initial.caseYearFrom ?? ''}
          aria-label="Ettől az évtől"
        />
        <input
          type="number"
          name="caseYearTo"
          min={1990}
          max={2100}
          placeholder="Évig"
          defaultValue={initial.caseYearTo ?? ''}
          aria-label="Eddig az évig"
        />
        <select name="sort" defaultValue={initial.sort} aria-label="Rendezés">
          {SORT_VALUES.map((sv) => (
            <option key={sv} value={sv}>
              {sortLabels[sv]}
            </option>
          ))}
        </select>
        <input
          type="hidden"
          name="limit"
          defaultValue={initial.limit ?? 20}
          aria-hidden
        />
        {pending && <span style={{ alignSelf: 'center', color: 'var(--muted)' }}>Frissítés…</span>}
        <button type="reset" className="btn btn-ghost">
          Töröld a szűrőket
        </button>
      </div>

      <input type="hidden" name="ts" value={search.get('ts') ?? ''} aria-hidden />
    </form>
  );
}
