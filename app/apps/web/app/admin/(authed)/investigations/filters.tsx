'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const STATUSES = [
  { value: 'new', label: 'Új' },
  { value: 'dismissed', label: 'Elvetve' },
  { value: 'merged', label: 'Összevonva' },
  { value: 'all', label: 'Mind' },
] as const;

const TIERS = [
  { value: 'all', label: 'Mind' },
  { value: 'internal', label: 'Belső' },
  { value: 'journalist', label: 'Újságíró' },
  { value: 'prosecutor', label: 'Ügyész' },
  { value: 'public', label: 'Publikus' },
] as const;

const SORTS = [
  { value: 'damage', label: 'Becsült kár' },
  { value: 'article_date', label: 'Cikk dátuma' },
  { value: 'recent', label: 'Frissítés' },
  { value: 'quantity', label: 'Pont' },
  { value: 'article_count', label: 'Cikkszám' },
] as const;

const QUANT = [
  { value: 'numbered', label: 'Számszerű' },
  { value: 'unnumbered', label: 'Számszerűsítetlen' },
  { value: 'all', label: 'Mind' },
] as const;

function buildHref(
  pathname: string,
  current: URLSearchParams,
  patch: Record<string, string>,
): string {
  const next = new URLSearchParams(current);
  for (const [k, v] of Object.entries(patch)) {
    if (v === '') next.delete(k);
    else next.set(k, v);
  }
  // Drop cursor whenever any filter changes.
  next.delete('cursor');
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function InvestigationFilters({
  numberedCount,
  unnumberedCount,
}: {
  numberedCount?: number;
  unnumberedCount?: number;
} = {}) {
  const pathname = usePathname() ?? '/admin/investigations';
  const params = useSearchParams() ?? new URLSearchParams();
  const status = params.get('status') ?? 'new';
  const tier = params.get('tier') ?? 'all';
  const sort = params.get('sort') ?? 'recent';
  const quant = params.get('quant') ?? 'numbered';
  const q = params.get('q') ?? '';

  return (
    <form
      className="admin-filters"
      method="GET"
      action={pathname}
      aria-label="Nyomozás szűrők"
    >
      <fieldset>
        <legend>Állapot</legend>
        <ul>
          {STATUSES.map((s) => (
            <li key={s.value}>
              <Link
                href={buildHref(pathname, params, { status: s.value })}
                aria-current={s.value === status ? 'page' : undefined}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </fieldset>
      <fieldset>
        <legend>Szint</legend>
        <ul>
          {TIERS.map((t) => (
            <li key={t.value}>
              <Link
                href={buildHref(pathname, params, { tier: t.value })}
                aria-current={t.value === tier ? 'page' : undefined}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </fieldset>
      <fieldset>
        <legend>Számszerűsítés</legend>
        <ul>
          {QUANT.map((q) => {
            const count =
              q.value === 'numbered'
                ? numberedCount
                : q.value === 'unnumbered'
                ? unnumberedCount
                : numberedCount !== undefined && unnumberedCount !== undefined
                ? numberedCount + unnumberedCount
                : undefined;
            return (
              <li key={q.value}>
                <Link
                  href={buildHref(pathname, params, { quant: q.value })}
                  aria-current={q.value === quant ? 'page' : undefined}
                >
                  {q.label}
                  {count !== undefined ? <span className="ct"> {count}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <fieldset>
        <legend>Rendezés</legend>
        <ul>
          {SORTS.map((s) => (
            <li key={s.value}>
              <Link
                href={buildHref(pathname, params, { sort: s.value })}
                aria-current={s.value === sort ? 'page' : undefined}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </fieldset>
      <label className="admin-filter-q">
        Név szerint:
        <input type="search" name="q" defaultValue={q} placeholder="kovacs laszlo" />
      </label>
      <button type="submit">Keresés</button>
    </form>
  );
}
