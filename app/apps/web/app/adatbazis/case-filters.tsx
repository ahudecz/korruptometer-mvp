'use client';

import { useRouter } from 'next/navigation';
import { useRef, useEffect, useState, useTransition, type FormEvent } from 'react';

const SEARCH_DEBOUNCE_MS = 350;

const OPEN_OPTIONS = [
  { value: '', label: 'Mindegyik' },
  { value: 'open', label: 'Folyamatban' },
  { value: 'closed', label: 'Lezárt' },
];

const DAMAGE_OPTIONS = [
  { value: '0', label: 'Bármekkora' },
  { value: '1000000000', label: '1 Mrd Ft+' },
  { value: '5000000000', label: '5 Mrd Ft+' },
  { value: '10000000000', label: '10 Mrd Ft+' },
  { value: '50000000000', label: '50 Mrd Ft+' },
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
  const [q, setQ] = useState(initial.q ?? '');
  const [offence, setOffence] = useState(initial.offence ?? '');
  const [open, setOpen] = useState(initial.open ?? '');
  const [minDamage, setMinDamage] = useState(initial.minDamage ?? '0');

  const [showOffence, setShowOffence] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [showDamage, setShowDamage] = useState(false);

  const offenceRef = useRef<HTMLDivElement>(null);
  const openRef    = useRef<HTMLDivElement>(null);
  const damageRef  = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (offenceRef.current && !offenceRef.current.contains(e.target as Node)) setShowOffence(false);
      if (openRef.current    && !openRef.current.contains(e.target as Node))    setShowOpen(false);
      if (damageRef.current  && !damageRef.current.contains(e.target as Node))  setShowDamage(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // scroll: false mindenhol — enélkül minden szűrőváltás (Enter a keresőben
  // is) a lap tetejére ugrott, elveszítve a felhasználó görgetési pozícióját.
  function pushUrl(overrides: Partial<{ q: string; offence: string; open: string; minDamage: string }>) {
    const merged = { q, offence, open, minDamage, ...overrides };
    const next = new URLSearchParams();
    if (merged.q) next.set('q', merged.q);
    if (merged.offence) next.set('offence', merged.offence);
    if (merged.open) next.set('open', merged.open);
    if (merged.minDamage && merged.minDamage !== '0') next.set('minDamage', merged.minDamage);
    const sort = initial.sort ?? 'damage_desc';
    if (sort !== 'damage_desc') next.set('sort', sort);
    startTransition(() => router.push(`/adatbazis${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false }));
  }

  // Élő szűrés gépelés közben — nincs valódi kliens-oldali adat (szerver
  // lapoz), ezért debounce-olt szerver-kérés helyettesíti az Entert; ha a
  // felhasználó mégis Entert üt, azt is elkapja az onSearchSubmit, csak
  // törli az időzítőt, hogy ne fusson le duplán.
  function onSearchChange(value: string) {
    setQ(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => pushUrl({ q: value }), SEARCH_DEBOUNCE_MS);
  }

  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    pushUrl({ q });
  }

  function clearAll() {
    setQ(''); setOffence(''); setOpen(''); setMinDamage('0');
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    startTransition(() => router.push('/adatbazis', { scroll: false }));
  }

  const hasFilter =
    (initial.q ?? '') !== '' ||
    (initial.offence ?? '') !== '' ||
    (initial.open ?? '') !== '' ||
    ((initial.minDamage ?? '0') !== '0');

  const activeOffenceLabel = offences.find(o => o.code === initial.offence)?.label;
  const activeOpenLabel    = OPEN_OPTIONS.find(o => o.value === initial.open)?.label;
  const activeDamageLabel  = DAMAGE_OPTIONS.find(o => o.value === (initial.minDamage ?? '0'))?.label;

  return (
    <div className="db-filters-wrap">
      {/* ── Kereső — elkülönítve ── */}
      <form onSubmit={onSearchSubmit} className="verdict-search-wrap db-search-wrap">
        <div className="verdict-search-inner">
          <svg className="verdict-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className="verdict-search-input"
            type="search"
            placeholder="Keresés: ügy, személy, intézmény…"
            value={q}
            onChange={e => onSearchChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {q && (
            <button
              className="verdict-search-clear"
              type="button"
              aria-label="Törlés"
              onClick={() => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); setQ(''); pushUrl({ q: '' }); }}
            >
              ✕
            </button>
          )}
        </div>
      </form>

      {/* ── Dropdown szűrők ── */}
      <div className="verdict-filters db-dropdown-filters">
        <div className="verdict-filter-dropdowns">

          {/* Jogsértés típusa */}
          <div className="verdict-dropdown-wrap" ref={offenceRef}>
            <button
              type="button"
              className={`verdict-dropdown-btn${initial.offence ? ' verdict-dropdown-btn--active' : ''}`}
              onClick={() => { setShowOffence(v => !v); setShowOpen(false); setShowDamage(false); }}
            >
              {initial.offence ? activeOffenceLabel : 'Jogsértés típusa'}
              {initial.offence && <span className="verdict-dropdown-badge">1</span>}
              <span className="verdict-dropdown-arrow">{showOffence ? '▲' : '▼'}</span>
            </button>
            {showOffence && (
              <div className="verdict-dropdown-panel">
                <label className="verdict-checkbox-item">
                  <input
                    type="radio" name="offence" checked={offence === ''}
                    onChange={() => { setOffence(''); setShowOffence(false); pushUrl({ offence: '' }); }}
                  />
                  <span>Összes típus</span>
                </label>
                {offences.map(o => (
                  <label key={o.code} className="verdict-checkbox-item">
                    <input
                      type="radio" name="offence" checked={offence === o.code}
                      onChange={() => { setOffence(o.code); setShowOffence(false); pushUrl({ offence: o.code }); }}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Státusz */}
          <div className="verdict-dropdown-wrap" ref={openRef}>
            <button
              type="button"
              className={`verdict-dropdown-btn${initial.open ? ' verdict-dropdown-btn--active' : ''}`}
              onClick={() => { setShowOpen(v => !v); setShowOffence(false); setShowDamage(false); }}
            >
              {initial.open ? activeOpenLabel : 'Státusz'}
              {initial.open && <span className="verdict-dropdown-badge">1</span>}
              <span className="verdict-dropdown-arrow">{showOpen ? '▲' : '▼'}</span>
            </button>
            {showOpen && (
              <div className="verdict-dropdown-panel">
                {OPEN_OPTIONS.map(o => (
                  <label key={o.value} className="verdict-checkbox-item">
                    <input
                      type="radio" name="open" checked={open === o.value}
                      onChange={() => { setOpen(o.value); setShowOpen(false); pushUrl({ open: o.value }); }}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Min. közpénz-érintettség */}
          <div className="verdict-dropdown-wrap" ref={damageRef}>
            <button
              type="button"
              className={`verdict-dropdown-btn${(initial.minDamage ?? '0') !== '0' ? ' verdict-dropdown-btn--active' : ''}`}
              onClick={() => { setShowDamage(v => !v); setShowOffence(false); setShowOpen(false); }}
            >
              {(initial.minDamage ?? '0') !== '0' ? `Min. ${activeDamageLabel}` : 'Min. közpénz'}
              {(initial.minDamage ?? '0') !== '0' && <span className="verdict-dropdown-badge">1</span>}
              <span className="verdict-dropdown-arrow">{showDamage ? '▲' : '▼'}</span>
            </button>
            {showDamage && (
              <div className="verdict-dropdown-panel">
                {DAMAGE_OPTIONS.map(o => (
                  <label key={o.value} className="verdict-checkbox-item">
                    <input
                      type="radio" name="minDamage"
                      checked={(minDamage === o.value) || (o.value === '0' && !minDamage)}
                      onChange={() => { setMinDamage(o.value); setShowDamage(false); pushUrl({ minDamage: o.value }); }}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {hasFilter && (
            <button
              type="button"
              className="verdict-clear-all"
              onClick={clearAll}
              disabled={pending}
            >
              × Szűrők törlése
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
