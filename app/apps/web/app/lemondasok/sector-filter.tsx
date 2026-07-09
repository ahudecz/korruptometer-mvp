'use client';

import { useRouter } from 'next/navigation';
import { useRef, useEffect, useState, useTransition } from 'react';

const SECTOR_OPTIONS = [
  { value: 'nemzetbiztonság', label: 'Nemzetbiztonság' },
  { value: 'fegyveres és rendvédelmi szervek', label: 'Fegyveres és rendvédelmi szervek' },
  { value: 'ügyészség', label: 'Ügyészség' },
  { value: 'honvédség', label: 'Honvédség' },
  { value: 'hatóságok, hivatalok, állami cégek', label: 'Hatóságok, hivatalok, állami cégek' },
  { value: 'egészségügy', label: 'Egészségügy' },
  { value: 'média', label: 'Média' },
  { value: 'sport és civil szervezetek', label: 'Sport és civil szervezetek' },
  { value: 'kultúra', label: 'Kultúra' },
  { value: 'közigazgatás', label: 'Közigazgatás' },
  { value: 'egyéb', label: 'Egyéb' },
];

export type SectorFilterState = {
  sector?: string;
};

type Props = {
  initial: SectorFilterState;
};

export function SectorFilter({ initial }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sector, setSector] = useState(initial.sector ?? '');
  const [showSector, setShowSector] = useState(false);
  const sectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (sectorRef.current && !sectorRef.current.contains(e.target as Node)) setShowSector(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function pushUrl(value: string) {
    const next = new URLSearchParams();
    if (value) next.set('terulet', value);
    startTransition(() => router.push(`/lemondasok${next.toString() ? `?${next.toString()}` : ''}`));
  }

  const activeLabel = SECTOR_OPTIONS.find(o => o.value === initial.sector)?.label;

  return (
    <div className="db-filters-wrap">
      <div className="db-dropdown-filters">
        <div className="verdict-filter-dropdowns">
          <div className="verdict-dropdown-wrap" ref={sectorRef}>
            <button
              type="button"
              className={`verdict-dropdown-btn${initial.sector ? ' verdict-dropdown-btn--active' : ''}`}
              onClick={() => setShowSector(v => !v)}
            >
              {initial.sector ? activeLabel : 'Terület'}
              {initial.sector && <span className="verdict-dropdown-badge">1</span>}
              <span className="verdict-dropdown-arrow">{showSector ? '▲' : '▼'}</span>
            </button>
            {showSector && (
              <div className="verdict-dropdown-panel">
                <label className="verdict-checkbox-item">
                  <input
                    type="radio" name="sector" checked={sector === ''}
                    onChange={() => { setSector(''); setShowSector(false); pushUrl(''); }}
                  />
                  <span>Összes terület</span>
                </label>
                {SECTOR_OPTIONS.map(o => (
                  <label key={o.value} className="verdict-checkbox-item">
                    <input
                      type="radio" name="sector" checked={sector === o.value}
                      onChange={() => { setSector(o.value); setShowSector(false); pushUrl(o.value); }}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {initial.sector && (
            <button
              type="button"
              className="verdict-clear-all"
              onClick={() => { setSector(''); pushUrl(''); }}
            >
              × Szűrő törlése
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
